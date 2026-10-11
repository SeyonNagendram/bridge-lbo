// Renders the favicon mark (app/icon.svg) to the raster icons browsers and iOS still ask for:
// app/favicon.ico (16, 32 and 48 px) and app/apple-icon.png (180 px, square: iOS rounds the corners).
// Run by hand after changing the mark; the outputs are committed.
//
//   node scripts/build-icons.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const svg = readFileSync(join(ROOT, "app/icon.svg"), "utf8");
// The Apple icon fills the whole square, so drop the tile's own rounded corners.
const squareSvg = svg.replace(' rx="6"', "");

// The installed Chrome, like scripts/check-browser.mjs; Playwright's own Chromium otherwise.
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage();

async function render(source, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  return page.locator("svg").screenshot({ omitBackground: true });
}

/** ICO container with PNG-encoded images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

const sizes = [16, 32, 48];
const images = [];
for (const size of sizes) images.push({ size, png: await render(svg, size) });
writeFileSync(join(ROOT, "app/favicon.ico"), ico(images));
writeFileSync(join(ROOT, "app/apple-icon.png"), await render(squareSvg, 180));

await browser.close();
console.log("Wrote app/favicon.ico (16, 32, 48) and app/apple-icon.png (180).");
