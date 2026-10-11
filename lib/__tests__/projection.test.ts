import { describe, expect, it } from "vitest";
import { projectionRows } from "../projection";
import { BASE_CASE, INPUT_KEYS, INPUT_SPECS, calculate, runLbo, type LboInputs } from "../lbo";
import { seededRandom } from "../lbo/__tests__/helpers";

const base = projectionRows(runLbo(BASE_CASE));
const rowOf = (rows: ReturnType<typeof projectionRows>, key: string) => rows.find((r) => r.key === key)!;

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
    expect(rowOf(base, "cash").cells[0]).toBe("0.0");
  });

  it("shows a dash for coverage when there is no interest", () => {
    const rows = projectionRows(runLbo({ ...BASE_CASE, leverage: 0 }));
    expect(rowOf(rows, "interestCoverage").cells.slice(1)).toEqual(["—", "—", "—", "—", "—"]);
  });

  it("never shows NaN, Infinity or undefined (2,000 random valid cases)", () => {
    const random = seededRandom(7);
    let checked = 0;
    while (checked < 2000) {
      const inputs = {} as LboInputs;
      for (const key of INPUT_KEYS) {
        const spec = INPUT_SPECS[key];
        const value = spec.min + random() * (spec.max - spec.min);
        inputs[key] = spec.integer ? Math.round(value) : value;
      }
      const outcome = calculate(inputs);
      if (!outcome.ok) continue;
      checked++;
      for (const row of projectionRows(outcome.result)) {
        for (const cell of row.cells) expect(cell).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });
});
