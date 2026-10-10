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
function withParens(value: number, suffix: string, decimals = 1): string {
  if (!Number.isFinite(value)) return NOT_MEANINGFUL;
  const text = fixed(Math.abs(value), decimals);
  const roundsToZero = text === fixed(0, decimals);
  return value < 0 && !roundsToZero ? `(${text}${suffix})` : `${text}${suffix}`;
}

/** €m amount, e.g. 31.6, 1,234.5, (1.6). The unit belongs in the label, not the cell. */
export function formatMoney(value: number): string {
  return withParens(value, "");
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

// ── Deltas vs base case ──────────────────────────────────────────────────────

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
  /** e.g. "+2.1pp", "−0.12x", "0.0" */
  text: string;
  direction: DeltaDirection;
}

/**
 * A change shown with an explicit sign rather than parentheses, e.g. +2.1pp / −0.12x.
 * Anything that rounds to zero is "flat" and unsigned, so colour never disagrees with the digits.
 */
export function formatDelta(value: number, decimals: number, suffix = ""): Delta | null {
  if (!Number.isFinite(value)) return null;
  const text = fixed(Math.abs(value), decimals);
  if (text === fixed(0, decimals)) return { text: `${text}${suffix}`, direction: "flat" };
  return value > 0
    ? { text: `+${text}${suffix}`, direction: "up" }
    : { text: `\u2212${text}${suffix}`, direction: "down" };
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
