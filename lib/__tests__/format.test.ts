import { describe, expect, it } from "vitest";
import {
  formatDelta,
  formatInputValue,
  formatMoM,
  formatMoney,
  formatMultiple,
  formatPercent,
  parseInputValue,
  stepInputValue,
} from "../format";
import { INPUT_SPECS } from "../lbo";

const pct = INPUT_SPECS.ebitdaMargin;
const mult = INPUT_SPECS.entryMultiple;
const revenue = INPUT_SPECS.revenue0;

describe("input fields", () => {
  it("shows percentages as whole-number percent with one decimal", () => {
    expect(formatInputValue(0.2, pct)).toBe("20.0");
    expect(formatInputValue(8, mult)).toBe("8.0");
    expect(formatInputValue(50, revenue)).toBe("50");
  });
  it("parses typed text, tolerating units and separators", () => {
    expect(parseInputValue("20.5", pct)).toBe(0.205);
    expect(parseInputValue("20 %", pct)).toBe(0.2);
    expect(parseInputValue("8x", mult)).toBe(8);
    expect(parseInputValue("1,000", revenue)).toBe(1000);
    expect(parseInputValue("−5", INPUT_SPECS.revenueGrowth)).toBe(-0.05);
  });
  it("returns NaN for empty or non-numeric text", () => {
    expect(parseInputValue("", pct)).toBeNaN();
    expect(parseInputValue("-", pct)).toBeNaN();
    expect(parseInputValue("abc", pct)).toBeNaN();
  });
  it("steps without floating-point noise and clamps to range", () => {
    expect(stepInputValue(0.2, pct, 1)).toBe(0.205);
    expect(stepInputValue(0.2, pct, -10)).toBe(0.15);
    expect(stepInputValue(19.5, mult, 10)).toBe(20);
    expect(stepInputValue(3, mult, -1)).toBe(3);
  });
});

describe("formatMoney", () => {
  it("uses one decimal and thousands separators", () => {
    expect(formatMoney(31.6)).toBe("31.6");
    expect(formatMoney(1234.56)).toBe("1,234.6");
  });
  it("wraps negatives in parentheses", () => {
    expect(formatMoney(-1.6)).toBe("(1.6)");
  });
  it("never shows a negative zero", () => {
    expect(formatMoney(-0.04)).toBe("0.0");
    expect(formatMoney(-0)).toBe("0.0");
  });
  it("never shows NaN or Infinity", () => {
    expect(formatMoney(NaN)).toBe("n.m.");
    expect(formatMoney(Infinity)).toBe("n.m.");
  });
});

describe("formatMultiple", () => {
  it("formats multiples", () => {
    expect(formatMultiple(8)).toBe("8.0x");
    expect(formatMultiple(2.553)).toBe("2.6x");
    expect(formatMultiple(-0.5)).toBe("(0.5x)");
  });
});

describe("formatPercent", () => {
  it("formats decimals as percentages", () => {
    expect(formatPercent(0.20621)).toBe("20.6%");
    expect(formatPercent(-0.05)).toBe("(5.0%)");
  });
});

describe("formatMoM", () => {
  it("uses two decimals", () => {
    expect(formatMoM(2.553382873447088)).toBe("2.55x");
    expect(formatMoM(0)).toBe("0.00x");
  });
});

describe("formatDelta", () => {
  it("signs changes explicitly, with no space before the unit", () => {
    expect(formatDelta(2.06, 1, "pp")).toEqual({ text: "+2.1pp", direction: "up" });
    expect(formatDelta(-0.123, 2, "x")).toEqual({ text: "\u22120.12x", direction: "down" });
  });
  it("treats anything that rounds to zero as flat and unsigned", () => {
    expect(formatDelta(-0.004, 2, "x")).toEqual({ text: "0.00x", direction: "flat" });
  });
  it("returns null for non-finite input", () => {
    expect(formatDelta(NaN, 1)).toBeNull();
  });
});
