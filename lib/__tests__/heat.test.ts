import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reads the heat-scale tokens straight from the stylesheet, so this test follows any change to them.
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

/** Token values in the first block matching `selector` (light :root, or the explicit dark theme). */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** color-mix(in srgb, a p, b): straight interpolation of the sRGB channels. */
const mix = (a: number[], b: number[], p: number) => a.map((x, i) => p * x + (1 - p) * b[i]);

function luminance([r, g, b]: number[]): number {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ["light", ":root {"],
  ["dark", ':root[data-theme="dark"] {'],
])("sensitivity heat scale, %s theme", (_, selector) => {
  const t = tokens(selector);
  const max = parseFloat(t["heat-max"]) / 100;

  it("keeps cell text at WCAG AA (4.5:1) at every tint", () => {
    // The tint moves the background towards the text colour, so checking 0–max in steps covers every cell.
    for (const heat of [t["heat-up"], t["heat-down"]]) {
      for (let share = 0; share <= max + 1e-9; share += 0.02) {
        const background = mix(rgb(heat), rgb(t.surface), share);
        expect(contrast(background, rgb(t.text))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("uses the agreed maximum tint", () => {
    expect(t["heat-max"]).toBe(selector.includes("dark") ? "40%" : "32%");
  });
});

it("defines the same dark tokens for the system setting and the manual toggle", () => {
  expect(tokens(':root:not([data-theme="light"]) {')).toEqual(tokens(':root[data-theme="dark"] {'));
});
