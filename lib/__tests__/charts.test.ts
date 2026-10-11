import { describe, expect, it } from "vitest";
import { allocateTenths, bridgeChart, debtChart, toTenths, DEBT_CHART } from "../charts";
import { formatEuroMillions } from "../format";
import { BASE_CASE, runLbo, type LboResult } from "../lbo";
import { randomValidInputs, seededRandom } from "../lbo/__tests__/helpers";

const base = runLbo(BASE_CASE);

/** A displayed figure back to tenths: "(1.6)" → −16, "1,234.5" → 12345. */
function parseTenths(text: string): number {
  const negative = text.startsWith("(");
  const value = Math.round(Number(text.replace(/[()€m,]/g, "")) * 10);
  return negative ? -value : value;
}

function randomResults(seed: number, count: number): LboResult[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => runLbo(randomValidInputs(random)));
}

/** Every number that ends up in the SVG markup. */
function coordinates(result: LboResult): number[] {
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

describe("toTenths", () => {
  it("rounds like the displayed figure", () => {
    expect(toTenths(31.64)).toBe(316);
    expect(toTenths(-1.6)).toBe(-16);
    expect(toTenths(0.15)).toBe(1); // 0.15 is stored as 0.1499…, displayed as 0.1
    expect(toTenths(-0.04)).toBe(0);
  });
});

describe("allocateTenths", () => {
  it("sums exactly to the target, each part within 0.1 of its exact value", () => {
    const values = [1.04, 2.04, 3.04];
    const parts = allocateTenths(values, 62);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(62);
    parts.forEach((p, i) => expect(Math.abs(p - values[i] * 10)).toBeLessThan(1));
  });

  it("moves the parts closest to the next tenth first", () => {
    expect(allocateTenths([1.01, 1.09], 21)).toEqual([10, 11]);
  });

  it("handles negative parts", () => {
    expect(allocateTenths([-1.6, 5.25], 36)).toEqual([-16, 52]);
  });
});

describe("bridgeChart", () => {
  it("runs equity invested → EBITDA growth → multiple expansion → debt paydown → fees → equity at exit", () => {
    expect(bridgeChart(base).steps.map((s) => s.label)).toEqual([
      "Equity invested",
      "EBITDA growth",
      "Multiple expansion",
      "Debt paydown",
      "Fees",
      "Equity at exit",
    ]);
  });

  it("matches the golden values in the base case", () => {
    const text = Object.fromEntries(bridgeChart(base).steps.map((s) => [s.key, s.text]));
    expect(text).toEqual({
      equityInvested: "31.6",
      ebitdaGrowth: "27.1",
      multipleExpansion: "0.0",
      debtPaydown: "23.6",
      fees: "(1.6)",
      equityAtExit: "80.7",
    });
  });

  it("includes cash build-up only when there is cash at exit", () => {
    const cashRich = runLbo({ ...BASE_CASE, leverage: 1, ebitdaMargin: 0.4 });
    expect(cashRich.exit.cash).toBeGreaterThan(0);
    const steps = bridgeChart(cashRich).steps.map((s) => s.key);
    expect(steps).toEqual([
      "equityInvested",
      "ebitdaGrowth",
      "multipleExpansion",
      "debtPaydown",
      "cashBuildUp",
      "fees",
      "equityAtExit",
    ]);
  });

  it("reconciles exactly to the KPI tiles and foots as displayed (1,000 random cases)", () => {
    for (const result of [base, ...randomResults(3, 1000)]) {
      const steps = bridgeChart(result).steps;
      const first = steps[0];
      const last = steps[steps.length - 1];
      // The totals are the tile figures, digit for digit.
      expect(parseTenths(first.text)).toBe(parseTenths(formatEuroMillions(result.entry.equity)));
      expect(parseTenths(last.text)).toBe(parseTenths(formatEuroMillions(result.exit.equity)));
      // The displayed parts add up to the displayed difference, with no rounding gap.
      const parts = steps.slice(1, -1).reduce((sum, s) => sum + parseTenths(s.text), 0);
      expect(parts).toBe(parseTenths(last.text) - parseTenths(first.text));
      // No part is bent by more than 0.1 from its exact value.
      for (const s of steps.slice(1, -1)) {
        const exact = { ...result.bridge }[s.key as keyof LboResult["bridge"]];
        expect(Math.abs(s.tenths - exact * 10)).toBeLessThan(1 + 1e-9);
      }
    }
  });

  it("chains the bars: each part starts where the previous one ended", () => {
    for (const result of [base, ...randomResults(5, 200)]) {
      const { steps, zero } = bridgeChart(result);
      expect(steps[0].start).toBe(zero);
      expect(steps[steps.length - 1].start).toBe(zero);
      for (let i = 1; i < steps.length - 1; i++) expect(steps[i].start).toBe(steps[i - 1].end);
      expect(steps[steps.length - 2].end).toBe(steps[steps.length - 1].end);
    }
  });

  it("colours by sign: increases and decreases, the two ends as totals", () => {
    const kinds = bridgeChart(base).steps.map((s) => s.kind);
    expect(kinds).toEqual(["total", "increase", "increase", "increase", "decrease", "total"]);
    const shortfall = bridgeChart(runLbo({ ...BASE_CASE, exitMultiple: 4 }));
    expect(shortfall.steps.find((s) => s.key === "multipleExpansion")!.kind).toBe("decrease");
  });

  it("keeps a negative equity value at exit on the chart", () => {
    const wipedOut = runLbo({ ...BASE_CASE, leverage: 7.5, exitMultiple: 3, revenueGrowth: -0.1 });
    expect(wipedOut.exit.equity).toBeLessThan(0);
    const { steps, zero } = bridgeChart(wipedOut);
    expect(zero).toBeGreaterThan(0);
    expect(steps[steps.length - 1].end).toBeLessThan(zero);
    expect(steps[steps.length - 1].text).toMatch(/^\(/);
  });
});

describe("debtChart", () => {
  it("has one bar per year, Year 0 to N, labelled like the projection table", () => {
    const chart = debtChart(base);
    expect(chart.bars.map((b) => b.year)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(chart.bars.map((b) => b.debtLabel)).toEqual(["50.0", "46.4", "42.4", "37.7", "32.4", "26.4"]);
    expect(chart.hasCash).toBe(false);
    expect(chart.bars.every((b) => b.cashHeight === 0 && b.cashLabel === null)).toBe(true);
  });

  it("draws the tallest bar at full height, all from the baseline", () => {
    const chart = debtChart(base);
    expect(chart.bars[0].debtHeight).toBe(DEBT_CHART.plotHeight);
    for (const b of chart.bars) expect(coordinatesClose(b.debtY + b.debtHeight, chart.baseline)).toBe(true);
  });

  it("adds a separate cash segment once the debt is repaid", () => {
    const chart = debtChart(runLbo({ ...BASE_CASE, leverage: 1, ebitdaMargin: 0.4 }));
    expect(chart.hasCash).toBe(true);
    const last = chart.bars[chart.bars.length - 1];
    expect(last.debtLabel).toBeNull();
    expect(last.cashHeight).toBeGreaterThan(0);
    expect(last.cashLabel).toMatch(/^\d/);
    // Segments never overlap: cash sits above the debt.
    for (const b of chart.bars) expect(b.cashY + b.cashHeight).toBeLessThanOrEqual(b.debtY + 1e-9);
  });

  it("handles a deal with no debt and no cash", () => {
    const chart = debtChart(runLbo({ ...BASE_CASE, leverage: 0, revenueGrowth: -0.1, ebitdaMargin: 0.01, capexPct: 0.2 }));
    for (const b of chart.bars) expect(Number.isFinite(b.debtY) && Number.isFinite(b.cashY)).toBe(true);
  });
});

describe("chart markup", () => {
  it("has every coordinate finite and rounded to 2 decimals (1,000 random cases)", () => {
    for (const result of [base, ...randomResults(9, 1000)]) {
      for (const value of coordinates(result)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBe(Math.round(value * 100) / 100);
      }
    }
  });

  it("never shows NaN, Infinity or undefined in a label", () => {
    for (const result of randomResults(13, 1000)) {
      const labels = [
        ...debtChart(result).bars.flatMap((b) => [b.debtLabel ?? "", b.cashLabel ?? ""]),
        ...bridgeChart(result).steps.map((s) => s.text),
      ];
      for (const label of labels) expect(label).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

function coordinatesClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.011;
}
