// Geometry and labels for the two charts (§5): debt paydown and returns attribution. Pure functions,
// no React, unit-tested like the engine. Every coordinate is rounded here, before it reaches the
// markup, so the server render and the browser produce identical HTML (no hydration mismatch).
// Horizontal positions are percentages of the plot width, so the SVG fills any container while text
// stays at its real size; vertical positions are pixels.

import type { LboResult } from "./lbo";
import { formatMoney, formatMultiple, formatShare } from "./format";
import { ZERO } from "./projection";

/** Rounds to 2 decimals: far below a pixel, and a short, stable number in the markup. */
export const coord = (value: number) => Math.round(value * 100) / 100;

// ── Debt paydown ─────────────────────────────────────────────────────────────

export const DEBT_CHART = {
  /** Height of the tallest bar. */
  plotHeight: 160,
  /** Room above the tallest bar for two lines of value labels. */
  top: 40,
  /** Room below the baseline for the year and leverage labels. */
  bottom: 40,
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
  /** Debt / EBITDA under the year label, e.g. 5.0x; an en dash once the debt is repaid. */
  leverageLabel: string;
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
    { year: 0, debt: result.entry.debt, cash: result.entry.cash, leverage: result.entry.leverage },
    ...result.years.map((y) => ({ year: y.year, debt: y.debt, cash: y.cash, leverage: y.leverage })),
  ];
  const max = Math.max(...points.map((p) => p.debt + p.cash));
  const scale = max > 0 ? plotHeight / max : 0;
  const baseline = top + plotHeight;
  const slot = 100 / points.length;

  const bars = points.map(({ year, debt, cash, leverage }, i): DebtBar => {
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
      leverageLabel: leverage === 0 ? ZERO : formatMultiple(leverage),
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
  /** Exact €m value; the parts sum to exit − invested. */
  value: number;
  /** Displayed figure, rounded on its own like the projection table, e.g. 31.6, (1.6), – for an exact zero. */
  text: string;
  /** Part ÷ total value created (Equity at exit − Equity invested); null for the two totals and exact zeros. */
  share: number | null;
  /** e.g. 55%, −3%, or n.m. when there is no value created to share out. null where `share` is. */
  shareText: string | null;
  /** Bar from `start` to `end`, % of plot width (start > end for a decrease). */
  start: number;
  end: number;
}

export interface BridgeGeometry {
  steps: BridgeStep[];
  /** x of zero, % of plot width. */
  zero: number;
  /** Equity at exit − Equity invested, €m. */
  valueCreated: number;
  /** false when value created is zero or negative (at display precision): shares read n.m. */
  sharesMeaningful: boolean;
}

/**
 * The value creation bridge (§4) as a waterfall, from equity invested to equity at exit. Each figure is
 * rounded on its own, as in the projection table, so the displayed steps may not sum exactly to the
 * displayed totals; the bars use the exact values, so the chart itself always closes.
 */
export function bridgeChart(result: LboResult): BridgeGeometry {
  const { bridge, entry, exit } = result;
  const valueCreated = exit.equity - entry.equity;
  // Zero or negative as displayed: a value created that rounds to 0.0 gives meaningless shares.
  const sharesMeaningful = Number(valueCreated.toFixed(1)) > 0;

  const parts = [
    { key: "ebitdaGrowth", label: "EBITDA growth", value: bridge.ebitdaGrowth },
    { key: "multipleExpansion", label: "Multiple expansion", value: bridge.multipleExpansion },
    { key: "debtPaydown", label: "Debt paydown", value: bridge.debtPaydown },
    // Only once there is cash, i.e. the debt has been repaid in full.
    ...(bridge.cashBuildUp > 0 ? [{ key: "cashBuildUp", label: "Cash build-up", value: bridge.cashBuildUp }] : []),
    { key: "fees", label: "Fees", value: bridge.fees },
  ];

  // Running total: each part runs from the previous running total to the next.
  const rows: { key: string; label: string; kind: BridgeKind; value: number; from: number; to: number }[] = [
    { key: "equityInvested", label: "Equity invested", kind: "total", value: entry.equity, from: 0, to: entry.equity },
  ];
  let running = entry.equity;
  for (const part of parts) {
    rows.push({ ...part, kind: part.value < 0 ? "decrease" : "increase", from: running, to: running + part.value });
    running += part.value;
  }
  // The exact running total equals exit.equity up to float noise; the total bar ends where the last part does.
  rows.push({ key: "equityAtExit", label: "Equity at exit", kind: "total", value: exit.equity, from: 0, to: running });

  const ends = rows.flatMap((r) => [r.from, r.to]);
  const min = Math.min(0, ...ends);
  const max = Math.max(0, ...ends);
  const span = max - min || 1;
  const x = (value: number) => coord(((value - min) / span) * 100);

  return {
    steps: rows.map((r) => {
      const share = r.kind === "total" || r.value === 0 ? null : r.value / valueCreated;
      return {
        key: r.key,
        label: r.label,
        kind: r.kind,
        value: r.value,
        // An exact zero reads as an en dash, as in the projection table.
        text: r.value === 0 ? ZERO : formatMoney(r.value),
        share,
        shareText: share === null ? null : sharesMeaningful ? formatShare(share) : "n.m.",
        start: x(r.from),
        end: x(r.to),
      };
    }),
    zero: x(0),
    valueCreated,
    sharesMeaningful,
  };
}
