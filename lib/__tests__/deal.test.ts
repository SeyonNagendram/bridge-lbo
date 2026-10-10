import { describe, expect, it } from "vitest";
import { dealSummary, fundingSplit, isBaseCase } from "../deal";
import { BASE_CASE, runLbo } from "../lbo";

const plain = (inputs: Parameters<typeof runLbo>[0]) =>
  dealSummary(runLbo(inputs))
    .map((s) => s.text)
    .join("");

describe("dealSummary", () => {
  it("reads like a memo's first line for the base case", () => {
    expect(plain(BASE_CASE)).toBe(
      "Acquire at 8.0x EBITDA (€80.0m), funded 61% debt / 39% equity; exit after 5 years at 8.0x → 20.6% IRR, 2.55x MoM.",
    );
  });
  it("marks the key figures as strong", () => {
    const strong = dealSummary(runLbo(BASE_CASE)).filter((s) => s.strong).map((s) => s.text);
    expect(strong).toEqual(["8.0x EBITDA", "€80.0m", "61% debt / 39% equity", "5 years", "8.0x", "20.6% IRR", "2.55x MoM"]);
  });
  it("handles an all-equity deal", () => {
    expect(plain({ ...BASE_CASE, leverage: 0 })).toContain("funded entirely with equity;");
  });
  it("shows n.m. when equity at exit is wiped out", () => {
    const text = plain({ ...BASE_CASE, leverage: 7.5, interestRate: 0.2, exitMultiple: 3 });
    expect(text).toContain("n.m. IRR, 0.00x MoM.");
    expect(text).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe("fundingSplit", () => {
  it("labels always sum to 100", () => {
    for (const leverage of [0, 0.5, 1, 2.5, 3.3, 5, 6.5, 7.5]) {
      const split = fundingSplit(runLbo({ ...BASE_CASE, leverage }).entry);
      expect(split.debtPct + split.equityPct).toBe(100);
    }
  });
  it("matches the base case", () => {
    const split = fundingSplit(runLbo(BASE_CASE).entry);
    expect(split.debtPct).toBe(61);
    expect(split.debtShare).toBeCloseTo(50 / 81.6, 12);
  });
});

describe("isBaseCase", () => {
  it("detects the base case, tolerating float noise", () => {
    expect(isBaseCase({ ...BASE_CASE })).toBe(true);
    expect(isBaseCase({ ...BASE_CASE, ebitdaMargin: 0.1 + 0.1 })).toBe(true);
    expect(isBaseCase({ ...BASE_CASE, exitMultiple: 8.5 })).toBe(false);
  });
});
