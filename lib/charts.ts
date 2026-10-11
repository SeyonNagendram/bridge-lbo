// Geometry and labels for the two charts (§5): debt paydown and returns attribution. Pure functions,
// no React, unit-tested like the engine. Every coordinate is rounded here, before it reaches the
// markup, so the server render and the browser produce identical HTML (no hydration mismatch).
// Horizontal positions are percentages of the plot width, so the SVG fills any container while text
// stays at its real size; vertical positions are pixels.

import type { LboResult } from "./lbo";
import { formatMoney } from "./format";
import { ZERO } from "./projection";

/** Rounds to 2 decimals: far below a pixel, and a short, stable number in the markup. */
export const coord = (value: number) => Math.round(value * 100) / 100;

/**
 * A €m value in tenths, rounded exactly as it is displayed (formatMoney, the KPI tiles), e.g. 31.64 → 316.
 * Goes through toFixed, which rounds the exact decimal value like Intl does; Math.round(v * 10) would
 * not (0.15 is stored as 0.1499…, which displays as 0.1 but × 10 gives 1.5 → 2).
 */
export function toTenths(value: number): number {
  const tenths = Math.round(Number(Math.abs(value).toFixed(1)) * 10);
  return value < 0 && tenths !== 0 ? -tenths : tenths;
}

/**
 * Rounds `values` (€m) to tenths so that they sum to exactly `target` tenths (largest remainder method).
 * Each value moves by at most 0.1 from its own rounding down, and the ones closest to the next tenth
 * move first, so the displayed parts foot to the displayed total without visibly bending any figure.
 */
export function allocateTenths(values: number[], target: number): number[] {
  const scaled = values.map((v) => v * 10);
  const result = scaled.map((v) => Math.floor(v));
  let remaining = target - result.reduce((a, b) => a + b, 0);
  // Largest fractional part first; ties go to the earlier item, so the result is deterministic.
  const order = scaled
    .map((v, i) => ({ i, fraction: v - Math.floor(v) }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i)
    .map((o) => o.i);
  for (let k = 0; remaining !== 0 && values.length > 0; k++) {
    // Normally 0 ≤ remaining ≤ values.length; the loop also absorbs any float edge case either way.
    const step = remaining > 0 ? 1 : -1;
    const i = step > 0 ? order[k % order.length] : order[order.length - 1 - (k % order.length)];
    result[i] += step;
    remaining -= step;
  }
  return result;
}

// ── Debt paydown ─────────────────────────────────────────────────────────────

export const DEBT_CHART = {
  /** Height of the tallest bar. */
  plotHeight: 160,
  /** Room above the tallest bar for two lines of value labels. */
  top: 40,
  /** Room below the baseline for the year labels. */
  bottom: 24,
  /** Bar width as a share of its year's slot. */
  barShare: 0.5,
  /** Surface gap between the debt and cash segments. */
  gap: 2,
} as const;

export interface DebtBar {
  year: number;
  /** Left edge and width, % of plot width. */
  x: number;
  width: number;
  /** Centre, % of plot width (labels). */
  centre: number;
  /** Debt segment, px from the top. Height 0 when there is no debt. */
  debtY: number;
  debtHeight: number;
  /** Cash segment, stacked above the debt with a small gap. Height 0 when there is no cash. */
  cashY: number;
  cashHeight: number;
  /** Top of the whole stack, px: the labels sit above it. */
  top: number;
  /** null once the debt is repaid and only cash is left (a dash above every cash bar would be noise). */
  debtLabel: string | null;
  /** null when there is no cash in this year. */
  cashLabel: string | null;
  debt: number;
  cash: number;
}

export interface DebtChartGeometry {
  bars: DebtBar[];
  /** y of the baseline, px. */
  baseline: number;
  height: number;
  hasCash: boolean;
}

/** A segment of real size never disappears entirely, however small next to the largest bar. */
const visible = (height: number) => (height > 0 ? Math.max(height, 1) : 0);

export function debtChart(result: LboResult): DebtChartGeometry {
  const { plotHeight, top, bottom, barShare, gap } = DEBT_CHART;
  const points = [
    { year: 0, debt: result.entry.debt, cash: result.entry.cash },
    ...result.years.map((y) => ({ year: y.year, debt: y.debt, cash: y.cash })),
  ];
  const max = Math.max(...points.map((p) => p.debt + p.cash));
  const scale = max > 0 ? plotHeight / max : 0;
  const baseline = top + plotHeight;
  const slot = 100 / points.length;

  const bars = points.map(({ year, debt, cash }, i): DebtBar => {
    const debtHeight = coord(visible(debt * scale));
    const gapAbove = debt > 0 && cash > 0 ? gap : 0;
    const cashHeight = cash > 0 ? coord(visible(cash * scale - gapAbove)) : 0;
    const debtY = coord(baseline - debtHeight);
    const cashY = coord(debtY - gapAbove - cashHeight);
    return {
      year,
      x: coord(slot * i + (slot * (1 - barShare)) / 2),
      width: coord(slot * barShare),
      centre: coord(slot * (i + 0.5)),
      debtY,
      debtHeight,
      cashY,
      cashHeight,
      top: cash > 0 ? cashY : debtY,
      // An exact zero reads as an en dash, as in the projection table.
      debtLabel: debt === 0 ? (cash > 0 ? null : ZERO) : formatMoney(debt),
      cashLabel: cash > 0 ? formatMoney(cash) : null,
      debt,
      cash,
    };
  });

  return { bars, baseline, height: baseline + bottom, hasCash: bars.some((b) => b.cash > 0) };
}

// ── Returns attribution ──────────────────────────────────────────────────────

export type BridgeKind = "total" | "increase" | "decrease";

export interface BridgeStep {
  key: string;
  label: string;
  kind: BridgeKind;
  /** The displayed figure in tenths of €m; the parts sum exactly to exit − invested. */
  tenths: number;
  /** Displayed figure, e.g. 31.6, (1.6). */
  text: string;
  /** Bar from `start` to `end`, % of plot width (start > end for a decrease). */
  start: number;
  end: number;
}

export interface BridgeGeometry {
  steps: BridgeStep[];
  /** x of zero, % of plot width. */
  zero: number;
}

/**
 * The value creation bridge (§4) as a waterfall, from equity invested to equity at exit. The two
 * totals are the KPI tile figures rounded exactly as the tiles show them; the parts are rounded to
 * add up to the difference (allocateTenths), so every label on the chart foots to the tiles.
 */
export function bridgeChart(result: LboResult): BridgeGeometry {
  const { bridge, entry, exit } = result;
  const invested = toTenths(entry.equity);
  const atExit = toTenths(exit.equity);

  const parts = [
    { key: "ebitdaGrowth", label: "EBITDA growth", value: bridge.ebitdaGrowth },
    { key: "multipleExpansion", label: "Multiple expansion", value: bridge.multipleExpansion },
    { key: "debtPaydown", label: "Debt paydown", value: bridge.debtPaydown },
    // Only once there is cash, i.e. the debt has been repaid in full.
    ...(bridge.cashBuildUp > 0 ? [{ key: "cashBuildUp", label: "Cash build-up", value: bridge.cashBuildUp }] : []),
    { key: "fees", label: "Fees", value: bridge.fees },
  ];
  const partTenths = allocateTenths(
    parts.map((p) => p.value),
    atExit - invested,
  );

  // Running total in tenths: each part runs from the previous running total to the next.
  const rows: { key: string; label: string; kind: BridgeKind; tenths: number; from: number; to: number }[] = [
    { key: "equityInvested", label: "Equity invested", kind: "total", tenths: invested, from: 0, to: invested },
  ];
  let running = invested;
  parts.forEach((part, i) => {
    const tenths = partTenths[i];
    rows.push({
      key: part.key,
      label: part.label,
      kind: tenths < 0 ? "decrease" : "increase",
      tenths,
      from: running,
      to: running + tenths,
    });
    running += tenths;
  });
  rows.push({ key: "equityAtExit", label: "Equity at exit", kind: "total", tenths: atExit, from: 0, to: atExit });

  const ends = rows.flatMap((r) => [r.from, r.to]);
  const min = Math.min(0, ...ends);
  const max = Math.max(0, ...ends);
  const span = max - min || 1;
  const x = (tenths: number) => coord(((tenths - min) / span) * 100);

  return {
    steps: rows.map((r) => ({
      key: r.key,
      label: r.label,
      kind: r.kind,
      tenths: r.tenths,
      text: formatMoney(r.tenths / 10),
      start: x(r.from),
      end: x(r.to),
    })),
    zero: x(0),
  };
}
