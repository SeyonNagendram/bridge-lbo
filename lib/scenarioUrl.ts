// Shareable scenarios (§5): the inputs in the URL query string, e.g. ?entry=9&lev=6&yrs=7. Only inputs
// that differ from the base case are written, in the units shown in the fields (percentages as 6.5,
// not 0.065). Reading is forgiving: an unknown key is ignored, and a missing, malformed or out-of-range
// value falls back to the base case for that input alone. Pure functions, no React, unit-tested.

import { BASE_CASE, INPUT_KEYS, INPUT_SPECS, validateInputs, type InputKey, type LboInputs } from "./lbo";
import { formatInputValue, parseInputValue } from "./format";

/** Short, readable query keys. Changing one breaks links already shared, so treat them as fixed. */
export const URL_KEYS: Readonly<Record<InputKey, string>> = Object.freeze({
  revenue0: "rev",
  ebitdaMargin: "margin",
  entryMultiple: "entry",
  leverage: "lev",
  feePct: "fees",
  revenueGrowth: "growth",
  interestRate: "rate",
  taxRate: "tax",
  capexPct: "capex",
  daPct: "da",
  nwcPct: "nwc",
  exitMultiple: "exit",
  holdingPeriod: "yrs",
});

const OUR_KEYS = new Set(Object.values(URL_KEYS));

const differs = (a: number, b: number) => Math.abs(a - b) > 1e-9;

/** Engine value → URL text in field units, without trailing zeros: 0.065 → "6.5", 9 → "9", 50.25 → "50.25". */
function toUrlValue(value: number, key: InputKey): string {
  const display = INPUT_SPECS[key].unit === "%" ? value * 100 : value;
  return String(Number(display.toFixed(4)));
}

/** The scenario part of a query string ("" for the base case), in a fixed key order. */
export function scenarioQuery(inputs: LboInputs): string {
  const params = new URLSearchParams();
  for (const key of INPUT_KEYS) {
    if (differs(inputs[key], BASE_CASE[key])) params.set(URL_KEYS[key], toUrlValue(inputs[key], key));
  }
  return params.toString();
}

/**
 * `search` with the scenario keys replaced by those for `inputs`, keeping any other parameters (a
 * link tracker's, say) as they were. Returns "" or a string starting with "?".
 */
export function mergeScenarioQuery(search: string, inputs: LboInputs): string {
  const params = new URLSearchParams(search);
  for (const key of OUR_KEYS) params.delete(key);
  const scenario = new URLSearchParams(scenarioQuery(inputs));
  for (const [key, value] of scenario) params.set(key, value);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Inputs from a query string. Each value is read as if typed into its field and rounded to the
 * field's display precision (so what the link restores is exactly what the fields then show); a
 * value that isn't a number, is out of range, or isn't a whole number where one is needed falls back
 * to the base case. If the result breaks the rule that leverage is below the entry multiple, both
 * fall back to the base case. The result always passes validation.
 */
export function inputsFromQuery(search: string): LboInputs {
  const params = new URLSearchParams(search);
  const inputs: LboInputs = { ...BASE_CASE };

  for (const key of INPUT_KEYS) {
    const text = params.get(URL_KEYS[key]);
    if (text === null) continue;
    const spec = INPUT_SPECS[key];
    const typed = parseInputValue(text, spec);
    if (!Number.isFinite(typed) || (spec.integer && !Number.isInteger(typed))) continue;
    const value = parseInputValue(formatInputValue(typed, spec), spec);
    // The same inclusive bounds as validateInputs; the leverage/entry rule is checked once all are read.
    if (value < spec.min - 1e-9 || value > spec.max + 1e-9) continue;
    inputs[key] = value;
  }

  if (validateInputs(inputs).length > 0) {
    inputs.leverage = BASE_CASE.leverage;
    inputs.entryMultiple = BASE_CASE.entryMultiple;
  }
  return inputs;
}
