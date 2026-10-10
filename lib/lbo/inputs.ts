import type { InputKey, LboInputs } from "./types";

/** Base case from the brief (§3). Percentages as decimals. */
export const BASE_CASE: Readonly<LboInputs> = Object.freeze({
  revenue0: 50,
  ebitdaMargin: 0.2,
  entryMultiple: 8.0,
  leverage: 5.0,
  feePct: 0.02,
  revenueGrowth: 0.06,
  interestRate: 0.07,
  taxRate: 0.3,
  capexPct: 0.03,
  daPct: 0.03,
  nwcPct: 0.1,
  exitMultiple: 8.0,
  holdingPeriod: 5,
});

export interface InputSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: "€m" | "%" | "x" | "years";
  integer?: boolean;
}

/** Allowed ranges and stepper increments (§3). Bounds are inclusive. */
export const INPUT_SPECS: Readonly<Record<InputKey, InputSpec>> = Object.freeze({
  revenue0: { label: "Revenue, Year 0", min: 1, max: 10_000, step: 1, unit: "€m" },
  ebitdaMargin: { label: "EBITDA margin", min: 0.01, max: 0.6, step: 0.005, unit: "%" },
  entryMultiple: { label: "Entry multiple", min: 3, max: 20, step: 0.5, unit: "x" },
  leverage: { label: "Leverage", min: 0, max: 8, step: 0.5, unit: "x" },
  feePct: { label: "Transaction fees", min: 0, max: 0.05, step: 0.005, unit: "%" },
  revenueGrowth: { label: "Revenue growth p.a.", min: -0.1, max: 0.3, step: 0.005, unit: "%" },
  interestRate: { label: "Interest rate on debt", min: 0, max: 0.2, step: 0.005, unit: "%" },
  taxRate: { label: "Tax rate", min: 0, max: 0.5, step: 0.005, unit: "%" },
  capexPct: { label: "Capex", min: 0, max: 0.2, step: 0.005, unit: "%" },
  daPct: { label: "D&A", min: 0, max: 0.2, step: 0.005, unit: "%" },
  nwcPct: { label: "NWC", min: 0, max: 0.5, step: 0.005, unit: "%" },
  exitMultiple: { label: "Exit multiple", min: 3, max: 20, step: 0.5, unit: "x" },
  holdingPeriod: { label: "Holding period", min: 3, max: 7, step: 1, unit: "years", integer: true },
});

export const INPUT_KEYS = Object.keys(INPUT_SPECS) as InputKey[];
