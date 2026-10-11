// Edge states (Phase 4): every section's display values for the scenarios at the limits of the inputs.
// The browser check (scripts/check-browser.mjs) loads the same scenarios by URL and checks the layout.

import { describe, expect, it } from "vitest";
import { BASE_CASE, runLbo, type LboInputs, type LboResult } from "../lbo";
import { bridgeChart, debtChart } from "../charts";
import { dealSummary, fundingSplit } from "../deal";
import { formatEuro, formatEuroDelta, formatMoM, formatPercent } from "../format";
import { projectionRows } from "../projection";
import { windowGrid } from "../sensitivityView";
import { warningLines } from "../warnings";

const run = (overrides: Partial<LboInputs>) => runLbo({ ...BASE_CASE, ...overrides });

/** Every string a section shows for a result. */
function displayed(result: LboResult): string[] {
  const debt = debtChart(result);
  const bridge = bridgeChart(result);
  const grid = windowGrid(result.inputs, { entryMultiple: result.inputs.entryMultiple, exitMultiple: result.inputs.exitMultiple });
  return [
    ...dealSummary(result).map((s) => s.text),
    formatEuro(result.entry.equity),
    formatEuro(result.exit.equity),
    formatMoM(result.returns.mom),
    result.returns.irr === null ? "n.m." : formatPercent(result.returns.irr),
    ...projectionRows(result).flatMap((r) => r.cells),
    ...debt.bars.flatMap((b) => [b.debtLabel ?? "", b.cashLabel ?? "", b.leverageLabel]),
    ...bridge.steps.flatMap((s) => [s.text, s.shareText ?? ""]),
    ...grid.cells.flat().flatMap((c) => (c ? [String(c.irr), String(c.mom)] : [])),
    ...warningLines(result),
  ];
}

/** Every number that becomes SVG geometry. */
function geometry(result: LboResult): number[] {
  const debt = debtChart(result);
  const bridge = bridgeChart(result);
  return [
    debt.baseline,
    debt.height,
    ...debt.bars.flatMap((b) => [b.x, b.width, b.centre, b.debtY, b.debtHeight, b.cashY, b.cashHeight, b.top]),
    bridge.zero,
    ...bridge.steps.flatMap((s) => [s.start, s.end]),
  ];
}

const EDGE_STATES: Record<string, Partial<LboInputs>> = {
  "holding period 3": { holdingPeriod: 3 },
  "holding period 7": { holdingPeriod: 7 },
  "leverage 0.0x": { leverage: 0 },
  "negative revenue growth": { revenueGrowth: -0.1 },
  "debt repaid early": { leverage: 1, ebitdaMargin: 0.4, holdingPeriod: 7 },
  "maximum revenue": { revenue0: 10_000 },
  "largest possible deal": { revenue0: 10_000, ebitdaMargin: 0.6, entryMultiple: 20, exitMultiple: 20, revenueGrowth: 0.3, holdingPeriod: 7 },
  "everything going wrong": { ebitdaMargin: 0.05, revenueGrowth: -0.1, leverage: 7.5, exitMultiple: 3, interestRate: 0.2, holdingPeriod: 7 },
};

describe.each(Object.entries(EDGE_STATES))("%s", (_name, overrides) => {
  const result = run(overrides);

  it("shows no NaN, Infinity or undefined anywhere", () => {
    for (const text of displayed(result)) expect(text).not.toMatch(/NaN|Infinity|undefined/);
    for (const value of geometry(result)) expect(Number.isFinite(value)).toBe(true);
  });

  it("has a column and a debt bar for every year, and debt never below zero", () => {
    const n = result.inputs.holdingPeriod;
    for (const row of projectionRows(result)) expect(row.cells).toHaveLength(n + 1);
    expect(debtChart(result).bars).toHaveLength(n + 1);
    for (const year of result.years) expect(year.debt).toBeGreaterThanOrEqual(0);
  });

  it("keeps the bars inside the plot", () => {
    const { bars, baseline } = debtChart(result);
    for (const bar of bars) {
      expect(bar.top).toBeGreaterThanOrEqual(0);
      expect(bar.debtY + bar.debtHeight).toBeLessThanOrEqual(baseline + 1e-9);
    }
    for (const step of bridgeChart(result).steps) {
      for (const x of [step.start, step.end]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("edge-state specifics", () => {
  it("leverage 0.0x: funded entirely with equity, no interest, coverage n/a, no debt paydown", () => {
    const result = run({ leverage: 0 });
    expect(fundingSplit(result.entry)).toMatchObject({ debtPct: 0, equityPct: 100 });
    expect(dealSummary(result).map((s) => s.text).join("")).toContain("funded entirely with equity");
    const rows = Object.fromEntries(projectionRows(result).map((r) => [r.key, r.cells]));
    expect(rows.interest.slice(1).every((c) => c === "–")).toBe(true);
    expect(rows.interestCoverage.slice(1).every((c) => c === "—")).toBe(true);
    expect(bridgeChart(result).steps.find((s) => s.key === "debtPaydown")?.text).toBe("–");
    expect(warningLines(result)).toEqual([]);
  });

  it("debt repaid early: debt reaches zero before exit, then cash builds up and shows in the chart", () => {
    const result = run({ leverage: 1, ebitdaMargin: 0.4, holdingPeriod: 7 });
    const firstZero = result.years.findIndex((y) => y.debt === 0);
    expect(firstZero).toBeGreaterThanOrEqual(0);
    expect(firstZero).toBeLessThan(result.years.length - 1);
    const chart = debtChart(result);
    expect(chart.hasCash).toBe(true);
    expect(chart.bars.at(-1)?.debtLabel).toBeNull();
    expect(chart.bars.at(-1)?.leverageLabel).toBe("–");
    expect(bridgeChart(result).steps.some((s) => s.key === "cashBuildUp")).toBe(true);
  });

  it("negative growth: EBITDA growth is a decrease, working capital is released", () => {
    const result = run({ revenueGrowth: -0.1 });
    expect(bridgeChart(result).steps.find((s) => s.key === "ebitdaGrowth")?.kind).toBe("decrease");
    expect(result.years.every((y) => y.changeInNwc < 0)).toBe(true);
  });
});

describe("large deals", () => {
  const max = run({ revenue0: 10_000 });
  const largest = run(EDGE_STATES["largest possible deal"]);

  it("KPI figures switch to €bn and stay short enough for a phone-width tile", () => {
    expect(formatEuro(max.entry.equity)).toBe("€6.3bn");
    expect(formatEuro(max.exit.equity)).toBe("€16.1bn");
    for (const result of [max, largest]) {
      for (const value of [result.entry.equity, result.exit.equity]) expect(formatEuro(value).length).toBeLessThanOrEqual(9);
      expect(formatEuroDelta(result.exit.equity - runLbo(BASE_CASE).exit.equity)!.text.length).toBeLessThanOrEqual(9);
    }
  });

  it("the deal summary uses compact units", () => {
    expect(dealSummary(max).map((s) => s.text).join("")).toContain("(€16.0bn)");
  });

  it("chart labels switch to €bn, so they fit a 375px screen", () => {
    for (const result of [max, largest]) {
      const debt = debtChart(result);
      const bridge = bridgeChart(result);
      expect(debt.unit).toBe("€bn");
      expect(bridge.unit).toBe("€bn");
      // At most "999.9" or "(99.9)": the same width as the base case's €m labels.
      for (const label of debt.bars.flatMap((b) => [b.debtLabel, b.cashLabel])) expect((label ?? "").length).toBeLessThanOrEqual(6);
      for (const step of bridge.steps) expect(step.text.length).toBeLessThanOrEqual(6);
    }
    expect(debtChart(max).bars[0].debtLabel).toBe("10.0");
    expect(debtChart(runLbo(BASE_CASE)).unit).toBe("€m");
  });

  it("the projection table keeps €m with thousands separators (it scrolls inside its own container)", () => {
    const revenue = projectionRows(max).find((r) => r.key === "revenue")!;
    expect(revenue.cells[0]).toBe("10,000.0");
  });
});
