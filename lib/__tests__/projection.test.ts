import { describe, expect, it } from "vitest";
import { ZERO, projectionRows } from "../projection";
import { BASE_CASE, INPUT_KEYS, INPUT_SPECS, calculate, runLbo, type LboInputs, type LboResult } from "../lbo";
import { seededRandom } from "../lbo/__tests__/helpers";

const base = projectionRows(runLbo(BASE_CASE));
const rowOf = (rows: ReturnType<typeof projectionRows>, key: string) => rows.find((r) => r.key === key)!;

/** A displayed cell back to a number: "(1.6)" → −1.6, "1,234.5" → 1234.5. */
function parseCell(text: string): number {
  if (text === ZERO) return 0;
  const negative = text.startsWith("(");
  const value = Number(text.replace(/[(),]/g, ""));
  return negative ? -value : value;
}

/** |(Net income + D&A − Capex − ΔNWC) − FCF| in year t, using the figures exactly as displayed. */
function displayedFootingGap(rows: ReturnType<typeof projectionRows>, t: number): number {
  const cell = (key: string) => parseCell(rowOf(rows, key).cells[t]);
  // Capex and ΔNWC are displayed as negatives, so the build is a plain sum of the displayed figures.
  const parts = cell("netIncome") + cell("daAddBack") + cell("capex") + cell("changeInNwc");
  return Math.round(Math.abs(parts - cell("fcf")) * 10) / 10;
}

/** `count` valid results from uniformly random inputs, reproducible from `seed`. */
function randomResults(seed: number, count: number): LboResult[] {
  const random = seededRandom(seed);
  const results: LboResult[] = [];
  while (results.length < count) {
    const inputs = {} as LboInputs;
    for (const key of INPUT_KEYS) {
      const spec = INPUT_SPECS[key];
      const value = spec.min + random() * (spec.max - spec.min);
      inputs[key] = spec.integer ? Math.round(value) : value;
    }
    const outcome = calculate(inputs);
    if (outcome.ok) results.push(outcome.result);
  }
  return results;
}

describe("projectionRows", () => {
  it("has every §5 row, in order, with subtotals marked", () => {
    expect(base.map((r) => r.label)).toEqual([
      "Revenue",
      "EBITDA",
      "EBITDA margin",
      "D&A",
      "EBIT",
      "Interest",
      "EBT",
      "Tax",
      "Net income",
      "D&A (add-back)",
      "Capex",
      "ΔNWC",
      "FCF",
      "Debt (end of year)",
      "Cash",
      "Leverage",
      "Interest coverage",
    ]);
    expect(base.filter((r) => r.subtotal).map((r) => r.label)).toEqual(["EBITDA", "EBIT", "Net income", "FCF"]);
  });

  it("has one column per year, Year 0 … N", () => {
    for (const row of base) expect(row.cells).toHaveLength(6);
    for (const row of projectionRows(runLbo({ ...BASE_CASE, holdingPeriod: 7 }))) expect(row.cells).toHaveLength(8);
  });

  it("adds D&A back as a positive figure, equal to the D&A deducted above", () => {
    const addBack = rowOf(base, "daAddBack").cells;
    expect(addBack[0]).toBe("");
    expect(addBack.slice(1)).toEqual(rowOf(base, "da").cells.slice(1).map((c) => c.replace(/[()]/g, "")));
  });

  it("FCF build foots exactly as displayed in the base case", () => {
    for (let t = 1; t <= 5; t++) expect(displayedFootingGap(base, t)).toBe(0);
  });

  it("FCF build foots as displayed for random inputs, within rounding (2,000 cases)", () => {
    // Each figure is rounded to 0.1 on its own, so the displayed parts can differ from the displayed
    // total by rounding alone: at most 4 × 0.05 + 0.05 = 0.25, i.e. 0.2 at one decimal. Never more.
    for (const result of randomResults(11, 2000)) {
      const rows = projectionRows(result);
      for (let t = 1; t <= result.years.length; t++) {
        const gap = displayedFootingGap(rows, t);
        expect(gap).toBeLessThanOrEqual(0.2 + 1e-9);
      }
      // The unrounded figures behind the cells foot exactly.
      for (const y of result.years) expect(y.netIncome + y.da - y.capex - y.changeInNwc).toBeCloseTo(y.fcf, 9);
    }
  });

  it("matches the golden values at one decimal", () => {
    expect(rowOf(base, "revenue").cells).toEqual(["50.0", "53.0", "56.2", "59.6", "63.1", "66.9"]);
    expect(rowOf(base, "fcf").cells).toEqual(["", "3.6", "4.1", "4.7", "5.3", "6.0"]);
    expect(rowOf(base, "debt").cells).toEqual(["50.0", "46.4", "42.4", "37.7", "32.4", "26.4"]);
    expect(rowOf(base, "interest").cells[1]).toBe("(3.5)");
    expect(rowOf(base, "leverage").cells[0]).toBe("5.0x");
    expect(rowOf(base, "interestCoverage").cells.slice(0, 2)).toEqual(["", "3.0x"]);
  });

  it("shows deductions in parentheses and leaves Year 0 flows empty", () => {
    for (const key of ["da", "interest", "tax", "capex", "changeInNwc"]) {
      const cells = rowOf(base, key).cells;
      expect(cells[0]).toBe("");
      expect(cells[1]).toMatch(/^\(\d/);
    }
  });

  it("shows exact zeros as an en dash", () => {
    // Base case: all FCF goes to debt repayment, so cash is exactly zero throughout.
    expect(rowOf(base, "cash").cells).toEqual(["–", "–", "–", "–", "–", "–"]);
    const allEquity = projectionRows(runLbo({ ...BASE_CASE, leverage: 0 }));
    expect(rowOf(allEquity, "debt").cells[0]).toBe("–");
    expect(rowOf(allEquity, "leverage").cells[0]).toBe("–");
    expect(rowOf(allEquity, "interest").cells.slice(1)).toEqual(["–", "–", "–", "–", "–"]);
  });

  it("marks the ratio rows", () => {
    expect(base.filter((r) => r.ratio).map((r) => r.label)).toEqual(["EBITDA margin", "Leverage", "Interest coverage"]);
  });

  it("shows a dash for coverage when there is no interest", () => {
    const rows = projectionRows(runLbo({ ...BASE_CASE, leverage: 0 }));
    expect(rowOf(rows, "interestCoverage").cells.slice(1)).toEqual(["—", "—", "—", "—", "—"]);
  });

  it("never shows NaN, Infinity or undefined (2,000 random valid cases)", () => {
    for (const result of randomResults(7, 2000)) {
      for (const row of projectionRows(result)) {
        for (const cell of row.cells) expect(cell).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });
});
