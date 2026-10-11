// Renders the PNG logo files in docs/brand/ from the SVGs there (written by scripts/outline-wordmark.py):
//   bridge-mark-512.png            the mark, 512 × 512, transparent outside the tile
//   bridge-lockup-{light,dark}.png  mark + wordmark, 320 px tall, transparent background
//   bridge-linkedin-1200x627.png   the light lockup centred on the app background (--bg), for LinkedIn media
// Run by hand after changing the mark; the outputs are committed.
//
//   node scripts/build-brand.mjs

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const BRAND = join(ROOT, "docs/brand");
const svg = (name) => `data:image/svg+xml;base64,${readFileSync(join(BRAND, name)).toString("base64")}`;
const viewBox = (name) => readFileSync(join(BRAND, name), "utf8").match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);

// The installed Chrome, like scripts/check-browser.mjs; Playwright's own Chromium otherwise.
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(file, { width, height, background = "transparent", body }) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<style>html,body{margin:0;width:${width}px;height:${height}px;background:${background};display:flex;align-items:center;justify-content:center}img{display:block}</style>${body}`,
  );
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.screenshot({ path: join(BRAND, file), omitBackground: background === "transparent" });
}

await render("bridge-mark-512.png", { width: 512, height: 512, body: `<img src="${svg("bridge-mark.svg")}" width="512" height="512">` });

const [w, h] = viewBox("bridge-lockup-light.svg");
const LOCKUP_HEIGHT = 320;
const lockupWidth = Math.round((w / h) * LOCKUP_HEIGHT);
for (const theme of ["light", "dark"]) {
  await render(`bridge-lockup-${theme}.png`, {
    width: lockupWidth,
    height: LOCKUP_HEIGHT,
    body: `<img src="${svg(`bridge-lockup-${theme}.svg`)}" width="${lockupWidth}" height="${LOCKUP_HEIGHT}">`,
  });
}

// LinkedIn media: the lockup at about half the width, centred on --bg.
const mediaWidth = 600;
await render("bridge-linkedin-1200x627.png", {
  width: 1200,
  height: 627,
  background: "#FAFAF8",
  body: `<img src="${svg("bridge-lockup-light.svg")}" width="${mediaWidth}" height="${Math.round((h / w) * mediaWidth)}">`,
});

await browser.close();
console.log(`Wrote docs/brand: bridge-mark-512.png, bridge-lockup-light.png, bridge-lockup-dark.png (${lockupWidth} × ${LOCKUP_HEIGHT}), bridge-linkedin-1200x627.png`);
