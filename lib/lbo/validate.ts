import { INPUT_KEYS, INPUT_SPECS, type InputSpec } from "./inputs";
import type { LboInputs, ValidationError } from "./types";

// Absorbs floating-point noise at the bounds (e.g. 0.1 + 0.2), far below any visible precision.
const EPS = 1e-9;

function formatBound(value: number, spec: InputSpec): string {
  switch (spec.unit) {
    case "%":
      return `${Number((value * 100).toFixed(2))}%`;
    case "x":
      return `${value.toFixed(1)}x`;
    case "€m":
      return `€${value.toLocaleString("en-US")}m`;
    case "years":
      return `${value}`;
  }
}

/**
 * Checks every input against its allowed range, plus the cross-field rule that
 * leverage must be below the entry multiple (otherwise equity would be zero or negative).
 * Returns an empty array when the inputs are valid.
 */
export function validateInputs(inputs: LboInputs): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of INPUT_KEYS) {
    const value = inputs[field];
    const spec = INPUT_SPECS[field];

    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push({ field, message: "Enter a number." });
      continue;
    }
    if (value < spec.min - EPS || value > spec.max + EPS) {
      errors.push({
        field,
        message: `Must be between ${formatBound(spec.min, spec)} and ${formatBound(spec.max, spec)}.`,
      });
      continue;
    }
    if (spec.integer && !Number.isInteger(value)) {
      errors.push({ field, message: "Must be a whole number." });
    }
  }

  const leverageOk = !errors.some((e) => e.field === "leverage" || e.field === "entryMultiple");
  if (leverageOk && inputs.leverage >= inputs.entryMultiple) {
    errors.push({ field: "leverage", message: "Leverage must be below the entry multiple." });
  }

  return errors;
}
