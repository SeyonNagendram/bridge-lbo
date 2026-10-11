import { describe, expect, it } from "vitest";
import { BASE_CASE, runLbo, type LboInputs } from "../lbo";
import { formatYears, warningLines } from "../warnings";

const run = (overrides: Partial<LboInputs>) => runLbo({ ...BASE_CASE, ...overrides });

describe("formatYears", () => {
  it("names one year, lists separate years and collapses consecutive ones into a range", () => {
    expect(formatYears([3])).toBe("Year\u00a03");
    expect(formatYears([1, 2, 3, 4, 5])).toBe("Years\u00a01–5");
    expect(formatYears([1, 2, 3, 5])).toBe("Years\u00a01–3, 5");
    expect(formatYears([2, 4])).toBe("Years\u00a02, 4");
    expect(formatYears([4, 5])).toBe("Years\u00a04–5");
  });
});

describe("warningLines", () => {
  it("is empty for the base case", () => {
    expect(warningLines(runLbo(BASE_CASE))).toEqual([]);
  });

  it("names the years of a cash shortfall", () => {
    // Shrinking revenue at a thin margin with heavy interest: free cash flow is negative every year.
    const lines = warningLines(run({ ebitdaMargin: 0.05, revenueGrowth: -0.1, leverage: 4, interestRate: 0.15 }));
    expect(lines[0]).toBe("Cash shortfall in Years\u00a01–5, funded with extra debt");
  });

  it("names the years with interest coverage below 2.0x", () => {
    const lines = warningLines(run({ leverage: 7, interestRate: 0.12 }));
    expect(lines).toEqual(["Interest coverage below 2.0x in Years\u00a01–5"]);
  });

  it("names the exit year when the IRR is not meaningful", () => {
    const result = run({ ebitdaMargin: 0.05, revenueGrowth: -0.1, leverage: 7.5, entryMultiple: 8, exitMultiple: 3, interestRate: 0.2, holdingPeriod: 7 });
    expect(result.returns.irr).toBeNull();
    expect(warningLines(result)).toContain("IRR not meaningful: equity at exit is zero or negative (Year\u00a07)");
  });
});
