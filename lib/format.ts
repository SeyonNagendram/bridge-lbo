// Display formatting for figures (§7). Pure functions, no React, so they are unit-tested
// like the engine. Negative values use banking parentheses; non-finite values never reach the screen.

import type { InputSpec } from "./lbo";

const NOT_MEANINGFUL = "n.m.";

const numberFormats = new Map<number, Intl.NumberFormat>();

/** en-US number with a fixed number of decimals, e.g. 1,234.5. */
function fixed(value: number, decimals: number): string {
  let format = numberFormats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, format);
  }
  return format.format(value);
}

/** Formats |value| and wraps negatives in parentheses; "-0.0" becomes "0.0". */
function withParens(value: number, suffix: string, decimals = 1, prefix = ""): string {
  if (!Number.isFinite(value)) return NOT_MEANINGFUL;
  const text = fixed(Math.abs(value), decimals);
  const roundsToZero = text === fixed(0, decimals);
  return value < 0 && !roundsToZero ? `(${prefix}${text}${suffix})` : `${prefix}${text}${suffix}`;
}

/** €m amount, e.g. 31.6, 1,234.5, (1.6). The unit belongs in the label, not the cell. */
export function formatMoney(value: number): string {
  return withParens(value, "");
}

/** Above this (as displayed, €m) a standalone figure switches to billions: €999.9m, then €1.0bn. */
const BILLION_FROM = 999.95;

/** True when |value| (€m) would display as 1,000.0 or more, so the figure reads better in billions. */
export function inBillions(value: number): boolean {
  return Math.abs(value) >= BILLION_FROM;
}

/**
 * € amount with the unit in the figure, banking-style, for standalone figures (KPI tiles, the deal
 * summary): €31.6m, (€5.2m); from €1,000m in compact units, €1.2bn, so large deals fit a phone-width tile.
 */
export function formatEuro(value: number): string {
  return inBillions(value) ? withParens(value / 1000, "bn", 1, "€") : withParens(value, "m", 1, "€");
}

/** Multiple, e.g. 8.0x, (0.5x). Entry/exit multiples and leverage use one decimal. */
export function formatMultiple(value: number): string {
  return withParens(value, "x");
}

/** Money-on-money multiple, two decimals, e.g. 2.55x. */
export function formatMoM(value: number): string {
  return withParens(value, "x", 2);
}

/** Decimal as a percentage, e.g. 0.2062 → 20.6%, −0.05 → (5.0%). */
export function formatPercent(value: number): string {
  return withParens(value * 100, "%");
}

/**
 * A share of a total in whole percent with an explicit minus rather than parentheses, e.g. 0.551 → 55%,
 * −0.033 → −3% (returns attribution). n.m. from ±1,000%: next to a near-zero total, shares stop meaning anything.
 */
export function formatShare(value: number): string {
  if (!Number.isFinite(value)) return NOT_MEANINGFUL;
  const percent = Number(Math.abs(value * 100).toFixed(0));
  if (percent >= 1000) return NOT_MEANINGFUL;
  return value < 0 && percent !== 0 ? `\u2212${percent}%` : `${percent}%`;
}

// ── Deltas vs base case ──────────────────────────────────────────────────────

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
  /** e.g. "+2.1pp", "−0.12x", "0.0" */
  text: string;
  direction: DeltaDirection;
}

/**
 * A change shown with an explicit sign rather than parentheses, e.g. +2.1pp / −0.12x / +€5.1m.
 * Anything that rounds to zero is "flat" and unsigned, so colour never disagrees with the digits.
 */
export function formatDelta(value: number, decimals: number, suffix = "", prefix = ""): Delta | null {
  if (!Number.isFinite(value)) return null;
  const text = `${prefix}${fixed(Math.abs(value), decimals)}${suffix}`;
  if (fixed(Math.abs(value), decimals) === fixed(0, decimals)) return { text, direction: "flat" };
  return value > 0 ? { text: `+${text}`, direction: "up" } : { text: `\u2212${text}`, direction: "down" };
}

/** A € change with an explicit sign, in the same units as formatEuro: +€5.1m, −€1.2bn. */
export function formatEuroDelta(value: number): Delta | null {
  return inBillions(value) ? formatDelta(value / 1000, 1, "bn", "€") : formatDelta(value, 1, "m", "€");
}

// ── Input fields ─────────────────────────────────────────────────────────────
// Percentages are stored as decimals (0.2) but typed and shown as 20.0, with the unit beside the field.

/** Engine value → the text shown in an input field. */
export function formatInputValue(value: number, spec: InputSpec): string {
  switch (spec.unit) {
    case "%":
      return (value * 100).toFixed(1);
    case "x":
      return value.toFixed(1);
    case "€m":
      return value.toFixed(1);
    case "years":
      return String(Math.round(value));
  }
}

/**
 * Text typed into an input field → engine value, or NaN when it isn't a number.
 * Tolerates unit characters, thousands separators and a typographic minus ("8x", "20%", "1,000", "−5").
 */
export function parseInputValue(text: string, spec: InputSpec): number {
  const cleaned = text.replace(/[\s,%x×€m]/gi, "").replace("−", "-");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return NaN;
  return spec.unit === "%" ? round(value / 100, 8) : value;
}

/** One stepper / arrow-key step from `value`, `steps` steps up (positive) or down (negative), clamped to range. */
export function stepInputValue(value: number, spec: InputSpec, steps: number): number {
  const next = round(value + steps * spec.step, 8);
  return Math.min(spec.max, Math.max(spec.min, next));
}

/** Rounds away floating-point noise (0.2 + 0.005 = 0.20500000000000002). */
function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
