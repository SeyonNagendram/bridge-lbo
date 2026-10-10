// Display formatting for figures (§7). Pure functions, no React, so they are unit-tested
// like the engine. Negative values use banking parentheses; non-finite values never reach the screen.

import type { InputSpec } from "./lbo";

const NOT_MEANINGFUL = "n.m.";

const oneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats |value| to one decimal and wraps negatives in parentheses; "-0.0" becomes "0.0". */
function withParens(value: number, suffix: string): string {
  if (!Number.isFinite(value)) return NOT_MEANINGFUL;
  const text = oneDecimal.format(Math.abs(value));
  const roundsToZero = text === oneDecimal.format(0);
  return value < 0 && !roundsToZero ? `(${text}${suffix})` : `${text}${suffix}`;
}

/** €m amount, e.g. 31.6, 1,234.5, (1.6). The unit belongs in the label, not the cell. */
export function formatMoney(value: number): string {
  return withParens(value, "");
}

/** Multiple, e.g. 8.0x, (0.5x). */
export function formatMultiple(value: number): string {
  return withParens(value, "x");
}

/** Decimal as a percentage, e.g. 0.2062 → 20.6%, −0.05 → (5.0%). */
export function formatPercent(value: number): string {
  return withParens(value * 100, "%");
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
      return String(Number(value.toFixed(1)));
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
