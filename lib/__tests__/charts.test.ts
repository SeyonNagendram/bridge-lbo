import { describe, expect, it } from "vitest";
import { bridgeChart, debtChart, DEBT_CHART } from "../charts";
import { formatEuroMillions, formatMoney, formatShare } from "../format";
import { projectionRows } from "../projection";
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

describe("formatShare", () => {
  it("shows whole percent with an explicit minus", () => {
    expect(formatShare(0.5512)).toBe("55%");
    expect(formatShare(-0.0326)).toBe("\u22123%");
    expect(formatShare(-0.004)).toBe("0%");
    expect(formatShare(12)).toBe("n.m.");
    expect(formatShare(Infinity)).toBe("n.m.");
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
    const steps = bridgeChart(base).steps;
    expect(Object.fromEntries(steps.map((s) => [s.key, s.text]))).toEqual({
      equityInvested: "31.6",
      ebitdaGrowth: "27.1",
      multipleExpansion: "–", // exactly zero: entry = exit multiple
      debtPaydown: "23.6",
      fees: "(1.6)",
      equityAtExit: "80.7",
    });
    expect(Object.fromEntries(steps.map((s) => [s.key, s.shareText]))).toEqual({
      equityInvested: null,
      ebitdaGrowth: "55%",
      multipleExpansion: null,
      debtPaydown: "48%",
      fees: "\u22123%",
      equityAtExit: null,
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

  it("shows the totals exactly as the KPI tiles and rounds every step on its own (1,000 random cases)", () => {
    for (const result of [base, ...randomResults(3, 1000)]) {
      const steps = bridgeChart(result).steps;
      const first = steps[0];
      const last = steps[steps.length - 1];
      expect(parseTenths(first.text)).toBe(parseTenths(formatEuroMillions(result.entry.equity)));
      expect(parseTenths(last.text)).toBe(parseTenths(formatEuroMillions(result.exit.equity)));
      for (const s of steps) expect(s.text).toBe(s.value === 0 ? "–" : formatMoney(s.value));
      // The exact parts foot; the displayed ones may miss by rounding alone: ≤ 0.05 per figure, so at
      // most 0.1 per part plus 0.1 for the two totals (shown at one decimal).
      const parts = steps.slice(1, -1);
      expect(parts.reduce((sum, s) => sum + s.value, 0)).toBeCloseTo(last.value - first.value, 6);
      const displayedGap = Math.abs(
        parts.reduce((sum, s) => sum + (s.text === "–" ? 0 : parseTenths(s.text)), 0) -
          (parseTenths(last.text) - parseTenths(first.text)),
      );
      expect(displayedGap).toBeLessThanOrEqual(Math.ceil((parts.length + 2) / 2));
    }
  });

  it("gives shares of value created that sum to 100% within rounding (1,000 random cases)", () => {
    let checked = 0;
    for (const result of [base, ...randomResults(17, 1000)]) {
      const chart = bridgeChart(result);
      const parts = chart.steps.slice(1, -1);
      if (!chart.sharesMeaningful) {
        for (const s of parts) expect(s.shareText).toBe(s.value === 0 ? null : "n.m.");
        continue;
      }
      // Exact shares sum to exactly 100%.
      expect(parts.reduce((sum, s) => sum + (s.share ?? 0), 0)).toBeCloseTo(1, 9);
      // Displayed shares (whole percent) are each within 0.5pp, so the sum is within 0.5pp per part.
      if (parts.some((s) => s.shareText === "n.m.")) continue; // a share of ±1,000% or more
      const displayed = parts.reduce((sum, s) => {
        if (s.shareText === null) return sum;
        return sum + Number(s.shareText.replace("\u2212", "-").replace("%", ""));
      }, 0);
      expect(Math.abs(displayed - 100)).toBeLessThanOrEqual(parts.length * 0.5);
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it("shows n.m. for every share when no value is created", () => {
    const loss = runLbo({ ...BASE_CASE, exitMultiple: 4 });
    expect(loss.exit.equity).toBeLessThan(loss.entry.equity);
    const chart = bridgeChart(loss);
    expect(chart.sharesMeaningful).toBe(false);
    expect(chart.steps.slice(1, -1).every((s) => s.shareText === "n.m.")).toBe(true);
    expect(chart.steps[0].shareText).toBeNull();
  });

  it("shows an exact zero as an en dash with no share, and keeps its row", () => {
    const noFees = bridgeChart(runLbo({ ...BASE_CASE, feePct: 0 }));
    const fees = noFees.steps.find((s) => s.key === "fees")!;
    expect([fees.text, fees.shareText, fees.start === fees.end]).toEqual(["–", null, true]);
  });

  it("chains the bars: each part starts where the previous one ended", () => {
    for (const result of [base, ...randomResults(5, 200)]) {
      const { steps, zero } = bridgeChart(result);
      expect(steps[0].start).toBe(zero);
      expect(steps[steps.length - 1].start).toBe(zero);
      for (let i = 1; i < steps.length - 1; i++) expect(steps[i].start).toBe(steps[i - 1].end);
      // The bars use exact values, so the exit total ends where the last part does, whatever the labels say.
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
    // Leverage under each year reads exactly as in the projection table.
    expect(chart.bars.map((b) => b.leverageLabel)).toEqual(projectionRows(base).find((r) => r.key === "leverage")!.cells);
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
    expect(last.leverageLabel).toBe("–");
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
        ...debtChart(result).bars.flatMap((b) => [b.debtLabel ?? "", b.cashLabel ?? "", b.leverageLabel]),
        ...bridgeChart(result).steps.flatMap((s) => [s.text, s.shareText ?? ""]),
      ];
      for (const label of labels) expect(label).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

function coordinatesClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.011;
}
