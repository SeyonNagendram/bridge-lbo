// Browser check: loads the app in Chrome and fails on any console error or warning (including React
// hydration mismatches, which only development builds report), uncaught exception, failed request,
// or broken interaction.
//
//   npm run build && npm run check:browser
//   npm run check:browser -- --screenshots shots   # also saves grid and chart screenshots, light and dark
//
// Runs against two targets:
//   prod  the static export in out/, served from a local port by this script
//   dev   `next dev`; if a dev server is already running for this project, that one is used

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const screenshotDir = args.includes("--screenshots") ? resolve(args[args.indexOf("--screenshots") + 1]) : null;

const problems = [];
const fail = (where, message) => problems.push(`[${where}] ${message}`);

// ── Targets ──────────────────────────────────────────────────────────────────

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** Serves out/ like a static host: "/" → index.html, "/x" → x.html, unknown paths → 404.html. */
function serveExport() {
  const outDir = join(ROOT, "out");
  if (!existsSync(join(outDir, "index.html"))) throw new Error("out/ is missing: run `npm run build` first.");
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const candidates = [path, join(path, "index.html"), `${path}.html`].map((p) => join(outDir, p));
    const file = candidates.find((p) => p.startsWith(outDir) && existsSync(p) && statSync(p).isFile());
    if (!file) {
      res.writeHead(404, { "content-type": "text/html" }).end(readFileSync(join(outDir, "404.html")));
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () => done({ url: `http://127.0.0.1:${server.address().port}/`, stop: () => server.close() })),
  );
}

/**
 * Starts `next dev`, or reuses the dev server already running for this project. Next allows one per
 * directory, but only finds out after printing its own "Local:" and "Ready" lines; it then prints the
 * existing server's address and exits. So the new server counts as ours only once it answers a
 * request and is still running a moment later.
 */
async function startDev() {
  const child = spawn(join(ROOT, "node_modules/.bin/next"), ["dev", "--port", "0"], { cwd: ROOT, env: process.env });
  let output = "";
  let exited = false;
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  child.on("exit", () => (exited = true));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const withSlash = (url) => (url.endsWith("/") ? url : `${url}/`);

  for (let waited = 0; waited < 90_000; waited += 250) {
    const existing = output.match(/existing server at (http:\/\/[^\s,]+)/);
    if (existing) return { url: withSlash(existing[1]), stop: () => {}, reused: true };
    const local = output.match(/Local:\s+(http:\/\/\S+)/);
    if (local && !exited && /Ready/.test(output)) {
      const answered = await fetch(local[1]).then((r) => r.ok, () => false);
      await sleep(1500);
      if (answered && !exited && !/Another next dev server/.test(output)) {
        return { url: withSlash(local[1]), stop: () => child.kill(), reused: false };
      }
    }
    if (exited && !/existing server at/.test(output)) break;
    await sleep(250);
  }
  child.kill();
  throw new Error(`next dev did not start:\n${output}`);
}

// ── Page helpers ─────────────────────────────────────────────────────────────

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" }); // the installed Chrome, no download needed
  } catch {
    return await chromium.launch(); // Playwright's own Chromium (`npx playwright install chromium`)
  }
}

/** Opens the app with every console/runtime/network problem recorded against `where`. */
async function openPage(browser, url, where, { dark = false, mobile = false } = {}) {
  const context = await browser.newContext({
    colorScheme: dark ? "dark" : "light",
    viewport: mobile ? { width: 375, height: 812 } : { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (["error", "warning", "assert"].includes(msg.type())) fail(where, `console.${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (error) => fail(where, `uncaught exception: ${error.message}`));
  page.on("requestfailed", (req) => fail(where, `request failed: ${req.url()} (${req.failure()?.errorText})`));
  page.on("response", (res) => {
    if (res.status() >= 400) fail(where, `HTTP ${res.status()}: ${res.url()}`);
  });
  // Browser-level warnings and errors that never reach the console API (e.g. CSP, deprecations).
  const cdp = await context.newCDPSession(page);
  await cdp.send("Log.enable");
  cdp.on("Log.entryAdded", ({ entry }) => {
    if (["error", "warning"].includes(entry.level)) fail(where, `browser ${entry.level} (${entry.source}): ${entry.text}`);
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("#sensitivity-title", { timeout: 30_000 });
  await page.waitForTimeout(500); // hydration has finished and reported any mismatch
  return { page, context };
}

const grid = (page) => page.locator('section[aria-labelledby="sensitivity-title"]');

/** The grid's axes, selected cell and the two multiples in the inputs. */
function gridState(page) {
  return grid(page).evaluate((section) => {
    const table = section.querySelector("table");
    const text = (nodes) => [...nodes].map((n) => n.textContent.replace(/^(Entry|Exit) /, "")).join(" ");
    return {
      cols: text([...table.querySelectorAll("thead th")].slice(1)),
      rows: text(table.querySelectorAll("tbody th")),
      selected: table.querySelector("[aria-current]")?.dataset.pos ?? null,
      focused: document.activeElement?.dataset?.pos ?? null,
      inputs: `${document.getElementById("input-entryMultiple").value}/${document.getElementById("input-exitMultiple").value}`,
    };
  });
}

function expectEqual(where, label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(where, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Waterfall steps as screen readers get them (the sr-only table), e.g. { "EBITDA growth": "27.1 55%", … }. */
function bridgeSteps(page) {
  return page.locator('section[aria-labelledby="attribution-title"] table').evaluate((table) =>
    Object.fromEntries(
      [...table.querySelectorAll("tbody tr")].map((tr) => [
        tr.cells[0].textContent,
        [tr.cells[1].textContent, tr.cells[2].textContent].filter(Boolean).join(" "),
      ]),
    ),
  );
}

/** A KPI tile's figure without the unit: "€31.6m" → "31.6", "(€5.2m)" → "(5.2)". */
function tileFigure(page, label) {
  return page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd/span[1]")
    .evaluate((el) => el.textContent.replace(/[€m]/g, ""));
}

/** Pairs of chart value labels whose boxes overlap (any chart), and labels sticking out of the viewport. */
function chartLabelProblems(page) {
  return page.evaluate(() => {
    const problems = [];
    for (const svg of document.querySelectorAll("section svg.overflow-visible")) {
      const boxes = [...svg.querySelectorAll("text")].map((t) => ({ text: t.textContent, box: t.getBoundingClientRect() }));
      boxes.forEach((a, i) => {
        if (a.box.right > document.documentElement.clientWidth || a.box.left < 0) problems.push(`"${a.text}" outside the viewport`);
        for (const b of boxes.slice(i + 1)) {
          const overlap =
            a.box.left < b.box.right - 0.5 && b.box.left < a.box.right - 0.5 &&
            a.box.top < b.box.bottom - 0.5 && b.box.top < a.box.bottom - 0.5;
          if (overlap) problems.push(`"${a.text}" overlaps "${b.text}"`);
        }
      });
    }
    return problems;
  });
}

/** Charts: one bar per year, the waterfall reconciles to the tiles, cash appears once debt is repaid. */
async function charts(page, where) {
  const debtBars = () => page.locator('section[aria-labelledby="debt-title"] tbody tr').count();
  expectEqual(where, "debt chart: Year 0 to 5", await debtBars(), 6);
  expectEqual(where, "waterfall, base case", await bridgeSteps(page), {
    "Equity invested": "31.6",
    "EBITDA growth": "27.1 55%",
    "Multiple expansion": "–",
    "Debt paydown": "23.6 48%",
    Fees: "(1.6) \u22123%",
    "Equity at exit": "80.7",
  });
  const leverage = await page
    .locator('section[aria-labelledby="debt-title"] tbody tr')
    .evaluateAll((rows) => rows.map((tr) => tr.cells[3].textContent));
  expectEqual(where, "leverage under the years", leverage[0], "5.0x");

  // A cash-generative deal: the debt is repaid, cash builds up, and the totals still match the tiles.
  await page.locator("#input-leverage").fill("1");
  await page.locator("#input-ebitdaMargin").fill("40");
  await page.locator("#input-holdingPeriod").fill("7");
  await page.waitForTimeout(100);
  expectEqual(where, "debt chart: Year 0 to 7", await debtBars(), 8);
  const steps = await bridgeSteps(page);
  expectEqual(where, "cash build-up step", "Cash build-up" in steps, true);
  expectEqual(where, "waterfall starts at the Equity invested tile", steps["Equity invested"], await tileFigure(page, "Equity invested"));
  expectEqual(where, "waterfall ends at the Equity at exit tile", steps["Equity at exit"], await tileFigure(page, "Equity at exit"));
  // Every step is rounded on its own, so the displayed steps foot to the totals within rounding only.
  const tenths = (t) => {
    const figure = t.split(" ")[0];
    return figure === "–" ? 0 : (figure.startsWith("(") ? -1 : 1) * Math.round(Number(figure.replace(/[(),]/g, "")) * 10);
  };
  const values = Object.values(steps).map(tenths);
  const gap = Math.abs(values.slice(1, -1).reduce((a, b) => a + b, 0) - (values.at(-1) - values[0]));
  if (gap > 3) fail(where, `waterfall: displayed steps miss the totals by ${gap / 10}, more than rounding allows`);
  const cashKey = page.locator('section[aria-labelledby="debt-title"] p > span', { hasText: /^Cash$/ }).first();
  if (!(await cashKey.isVisible())) fail(where, "debt chart: no Cash legend key once cash builds up");
  for (const problem of await chartLabelProblems(page)) fail(where, `chart labels: ${problem}`);

  await page.getByRole("button", { name: "Reset to base case" }).click();
}

// ── Scenarios ────────────────────────────────────────────────────────────────

/** Desktop interactions: stable grid, window shifting, keyboard, metric toggle, invalid input, reset. */
async function interactions(page, where) {
  expectEqual(where, "initial grid", await gridState(page), {
    cols: "7.0x 7.5x 8.0x 8.5x 9.0x",
    rows: "7.0x 7.5x 8.0x 8.5x 9.0x",
    selected: "2-2",
    focused: null,
    inputs: "8.0/8.0",
  });

  await page.locator('[data-pos="1-3"]').click();
  const afterClick = await gridState(page);
  expectEqual(where, "click applies without re-centring", [afterClick.rows, afterClick.cols, afterClick.selected, afterClick.inputs], [
    "7.0x 7.5x 8.0x 8.5x 9.0x",
    "7.0x 7.5x 8.0x 8.5x 9.0x",
    "1-3",
    "7.5/8.5",
  ]);

  await page.getByRole("button", { name: "Show higher exit multiples" }).click();
  expectEqual(where, "› shifts the exit axis", (await gridState(page)).cols, "7.5x 8.0x 8.5x 9.0x 9.5x");

  await page.locator('[data-pos="0-1"]').focus();
  await page.keyboard.press("ArrowUp");
  const afterEdge = await gridState(page);
  expectEqual(where, "arrow at the edge shifts the window", [afterEdge.rows, afterEdge.focused], ["6.5x 7.0x 7.5x 8.0x 8.5x", "0-1"]);

  await page.keyboard.press("Enter");
  expectEqual(where, "Enter applies the focused cell", (await gridState(page)).inputs, "6.5/8.0");

  await page.getByRole("button", { name: "MoM" }).click();
  const momCell = await page.locator('[data-pos="2-2"]').textContent();
  if (!/^\d+\.\d{2}x$/.test(momCell ?? "")) fail(where, `MoM toggle: centre cell shows "${momCell}"`);

  await page.locator("#input-entryMultiple").fill("2");
  if (!(await page.getByText("Some inputs are invalid").isVisible())) fail(where, "invalid input: no message shown");

  await page.getByRole("button", { name: "Reset to base case" }).click();
  expectEqual(where, "reset re-centres on the base case", await gridState(page), {
    cols: "7.0x 7.5x 8.0x 8.5x 9.0x",
    rows: "7.0x 7.5x 8.0x 8.5x 9.0x",
    selected: "2-2",
    focused: null,
    inputs: "8.0/8.0",
  });

  // Nothing on the page may read NaN, Infinity or undefined.
  const body = await page.locator("body").innerText();
  if (/NaN|Infinity|undefined/.test(body)) fail(where, "page text contains NaN, Infinity or undefined");
}

/** Phone width: no horizontal page scroll, collapsible assumptions, the table's edge fade. */
async function mobile(page, where) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) fail(where, `page scrolls horizontally by ${overflow}px`);

  const toggle = page.locator('[aria-controls="assumptions-body"]');
  await toggle.click();
  expectEqual(where, "assumptions collapse", await toggle.getAttribute("aria-expanded"), "false");

  const table = page.locator("#projection-title + div");
  expectEqual(where, "projection fade while more to scroll", await table.evaluate((el) => el.hasAttribute("data-fade-right")), true);
  await table.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await page.waitForTimeout(200);
  expectEqual(where, "projection fade gone at the end", await table.evaluate((el) => el.hasAttribute("data-fade-right")), false);
}

// ── Run ──────────────────────────────────────────────────────────────────────

const prod = await serveExport();
const dev = await startDev();
const browser = await launch();
const shots = {};

try {
  for (const [name, target] of [
    ["prod", prod],
    ["dev", dev],
  ]) {
    for (const dark of [false, true]) {
      for (const isMobile of [false, true]) {
        const where = `${name} ${dark ? "dark" : "light"} ${isMobile ? "375px" : "1280px"}`;
        const { page, context } = await openPage(browser, target.url, where, { dark, mobile: isMobile });
        if (screenshotDir && name === "prod" && !isMobile) {
          mkdirSync(screenshotDir, { recursive: true });
          const file = join(screenshotDir, `grid-${dark ? "dark" : "light"}.png`);
          await grid(page).screenshot({ path: file });
          shots[dark ? "dark" : "light"] = file;
        }
        if (screenshotDir && name === "prod") {
          mkdirSync(screenshotDir, { recursive: true });
          const suffix = `${dark ? "dark" : "light"}-${isMobile ? "375" : "1280"}`;
          for (const chart of ["debt", "attribution"]) {
            await page.locator(`section[aria-labelledby="${chart}-title"]`).screenshot({ path: join(screenshotDir, `${chart}-${suffix}.png`) });
          }
        }
        for (const problem of await chartLabelProblems(page)) fail(where, `chart labels: ${problem}`);
        await charts(page, where);
        if (screenshotDir && name === "prod") {
          // The cash case, captured mid-check would be reset; redo it for a picture.
          await page.locator("#input-leverage").fill("1");
          await page.locator("#input-ebitdaMargin").fill("40");
          await page.locator("#input-holdingPeriod").fill("7");
          await page.waitForTimeout(700);
          const suffix = `${dark ? "dark" : "light"}-${isMobile ? "375" : "1280"}`;
          await page.locator('section[aria-labelledby="debt-title"]').screenshot({ path: join(screenshotDir, `debt-cash-${suffix}.png`) });
          await page.locator('section[aria-labelledby="attribution-title"]').screenshot({ path: join(screenshotDir, `attribution-cash-${suffix}.png`) });
          await page.getByRole("button", { name: "Reset to base case" }).click();
        }
        if (isMobile) await mobile(page, where);
        else if (!dark) await interactions(page, where);
        await context.close();
      }
    }
  }

  // Light and dark grids side by side in one image, for comparing the shading strength.
  if (screenshotDir && shots.light && shots.dark) {
    const img = (f) => `<img src="data:image/png;base64,${readFileSync(f).toString("base64")}" style="width:50%">`;
    const page = await browser.newPage({ viewport: { width: 1600, height: 400 } });
    await page.setContent(`<body style="margin:0;display:flex">${img(shots.light)}${img(shots.dark)}</body>`);
    writeFileSync(join(screenshotDir, "grid-compare.png"), await page.screenshot({ fullPage: true }));
    await page.close();
  }
} catch (error) {
  fail("run", error.stack ?? String(error));
} finally {
  await browser.close();
  prod.stop();
  if (!dev.reused) dev.stop();
}

console.log(`Targets: prod ${prod.url} · dev ${dev.url}${dev.reused ? " (already running)" : ""}`);
if (screenshotDir) console.log(`Screenshots: ${screenshotDir}`);
if (problems.length > 0) {
  console.log(`\nFAIL: ${problems.length} problem(s)\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("PASS: 8 page loads (prod + dev × light + dark × desktop + phone), no console errors or warnings, interactions and charts OK");
