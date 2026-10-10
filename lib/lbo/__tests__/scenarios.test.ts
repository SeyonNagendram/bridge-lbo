// Additional required tests from brief §6, plus robustness checks from §10.
import { describe, expect, it } from "vitest";
import { calculate, runLbo } from "../engine";
import { BASE_CASE } from "../inputs";
import { sensitivityGrid } from "../sensitivity";
import type { LboInputs } from "../types";
import { expectAllFinite, randomValidInputs, seededRandom } from "./helpers";

const scenario = (overrides: Partial<LboInputs>): LboInputs => ({ ...BASE_CASE, ...overrides });

describe("returns bridge reconciles", () => {
  it("components sum to Equity_exit − Equity_0 for 1,000 random valid inputs", () => {
    const rand = seededRandom(20261010);
    for (let i = 0; i < 1000; i++) {
      const r = runLbo(randomValidInputs(rand));
      const b = r.bridge;
      const sum = b.ebitdaGrowth + b.multipleExpansion + b.debtPaydown + b.cashBuildUp + b.fees;
      const target = r.exit.equity - r.entry.equity;
      // Algebraically exact; allow only floating-point rounding (relative to the size of the deal).
      const scale = Math.max(1, Math.abs(r.exit.enterpriseValue), Math.abs(r.entry.enterpriseValue));
      expect(Math.abs(sum - target)).toBeLessThan(1e-9 * scale);
      expect(Math.abs(b.total - target)).toBeLessThan(1e-9 * scale);
    }
  });
});

describe("high cash flow: debt fully repaid", () => {
  const r = runLbo(
    scenario({ ebitdaMargin: 0.6, leverage: 1.0, entryMultiple: 6.0, revenueGrowth: 0.1 }),
  );

  it("debt reaches zero and never goes negative", () => {
    expect(r.exit.debt).toBe(0);
    r.years.forEach((y) => expect(y.debt).toBeGreaterThanOrEqual(0));
  });

  it("cash builds up once debt is repaid", () => {
    expect(r.exit.cash).toBeGreaterThan(0);
    for (let i = 1; i < r.years.length; i++) {
      expect(r.years[i].cash).toBeGreaterThanOrEqual(r.years[i - 1].cash);
    }
    // In the year debt hits zero, only the excess FCF goes to cash.
    const payoff = r.years.find((y) => y.debt === 0)!;
    const before = payoff.year === 1 ? r.entry.debt : r.years[payoff.year - 2].debt;
    expect(payoff.cash).toBeCloseTo(payoff.fcf - before, 10);
  });

  it("equity at exit includes the cash", () => {
    expect(r.exit.equity).toBeCloseTo(r.exit.enterpriseValue - r.exit.debt + r.exit.cash, 10);
    expect(r.exit.equity).toBeGreaterThan(r.exit.enterpriseValue);
    expect(r.bridge.cashBuildUp).toBe(r.exit.cash);
  });
});

describe("negative free cash flow", () => {
  // EBITDA 2.5, debt 17.5 at 15% → interest 2.6 exceeds EBIT, FCF < 0 every year.
  const r = runLbo(
    scenario({ ebitdaMargin: 0.05, leverage: 7.0, entryMultiple: 10.0, interestRate: 0.15, revenueGrowth: 0 }),
  );

  it("debt increases by the shortfall and cash is unchanged", () => {
    let prevDebt = r.entry.debt;
    for (const y of r.years) {
      expect(y.fcf).toBeLessThan(0);
      expect(y.debt).toBeCloseTo(prevDebt - y.fcf, 10);
      expect(y.debt).toBeGreaterThan(prevDebt);
      expect(y.cash).toBe(0);
      expect(y.tax).toBe(0); // negative EBT → no negative tax
      prevDebt = y.debt;
    }
  });

  it("raises a cash shortfall warning naming the years", () => {
    const w = r.warnings.find((w) => w.kind === "cashShortfall");
    expect(w).toBeDefined();
    expect(w).toMatchObject({ years: [1, 2, 3, 4, 5] });
    expect(w!.message).toContain("Cash shortfall in Years 1, 2, 3, 4, 5");
  });

  it("names a single year correctly", () => {
    // Heavy working-capital build: FCF is negative in Year 1 only, then turns positive as EBITDA grows.
    const one = runLbo(scenario({ ebitdaMargin: 0.12, revenueGrowth: 0.1, nwcPct: 0.4 }));
    const w = one.warnings.find((w) => w.kind === "cashShortfall");
    expect(w).toMatchObject({ years: [1] });
    expect(w!.message).toContain("Cash shortfall in Year 1:");
  });

  it("raises a low interest coverage warning", () => {
    expect(r.warnings.some((w) => w.kind === "lowInterestCoverage")).toBe(true);
  });
});

describe("equity at exit ≤ 0", () => {
  const r = runLbo(
    scenario({
      ebitdaMargin: 0.05,
      entryMultiple: 15.0,
      leverage: 8.0,
      interestRate: 0.2,
      revenueGrowth: 0,
      exitMultiple: 3.0,
    }),
  );

  it("reports MoM 0 and IRR as not meaningful", () => {
    expect(r.exit.equity).toBeLessThanOrEqual(0);
    expect(r.returns.mom).toBe(0);
    expect(r.returns.irr).toBeNull();
    expect(r.returns.irrMeaningful).toBe(false);
    expect(r.warnings.some((w) => w.kind === "irrNotMeaningful")).toBe(true);
  });

  it("produces no NaN or Infinity anywhere", () => {
    expectAllFinite(r);
    expectAllFinite(sensitivityGrid(r.inputs));
  });
});

describe("zero debt", () => {
  const r = runLbo(scenario({ leverage: 0 }));

  it("interest coverage is null (shown as —), not Infinity", () => {
    r.years.forEach((y) => {
      expect(y.interest).toBe(0);
      expect(y.interestCoverage).toBeNull();
    });
    expect(r.warnings).toEqual([]);
  });
});

describe("holding period", () => {
  it.each([3, 4, 6, 7])("produces exactly %i projection years", (n) => {
    const r = runLbo(scenario({ holdingPeriod: n }));
    expect(r.years.map((y) => y.year)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    expect(r.exit.ebitda).toBe(r.years[n - 1].ebitda);
  });
});

describe("no NaN / Infinity / undefined reachable", () => {
  it("across 1,000 random valid inputs, including the sensitivity grid", () => {
    const rand = seededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const inputs = randomValidInputs(rand);
      const outcome = calculate(inputs);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      expectAllFinite(outcome.result);
      expectAllFinite(sensitivityGrid(inputs));
    }
  });
});

describe("sensitivity grid edges", () => {
  it("blanks cells whose multiples leave the allowed range", () => {
    const grid = sensitivityGrid(scenario({ entryMultiple: 3.5, leverage: 2.0, exitMultiple: 19.5 }));
    expect(grid.entryMultiples).toEqual([2.5, 3.0, 3.5, 4.0, 4.5]);
    expect(grid.exitMultiples).toEqual([18.5, 19.0, 19.5, 20.0, 20.5]);
    expect(grid.cells[0].every((c) => c === null)).toBe(true); // entry 2.5x < 3.0x
    expect(grid.cells.every((row) => row[4] === null)).toBe(true); // exit 20.5x > 20.0x
    expect(grid.cells[1][0]).not.toBeNull();
  });

  it("blanks cells where leverage would be ≥ the entry multiple", () => {
    const grid = sensitivityGrid(scenario({ entryMultiple: 5.5, leverage: 5.0 }));
    expect(grid.entryMultiples).toEqual([4.5, 5.0, 5.5, 6.0, 6.5]);
    expect(grid.cells[0].every((c) => c === null)).toBe(true);
    expect(grid.cells[1].every((c) => c === null)).toBe(true);
    expect(grid.cells[2].every((c) => c !== null)).toBe(true);
  });

  it("keeps clean axis values for off-step centres", () => {
    const grid = sensitivityGrid(scenario({ entryMultiple: 8.3, exitMultiple: 7.1 }));
    expect(grid.entryMultiples).toEqual([7.3, 7.8, 8.3, 8.8, 9.3]);
    expect(grid.exitMultiples).toEqual([6.1, 6.6, 7.1, 7.6, 8.1]);
  });
});
