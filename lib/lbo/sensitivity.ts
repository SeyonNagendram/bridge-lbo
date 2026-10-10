import { runLbo } from "./engine";
import type { LboInputs } from "./types";
import { validateInputs } from "./validate";

export const SENSITIVITY_STEP = 0.5;
export const SENSITIVITY_HALF_WIDTH = 2; // 2 steps either side → 5 × 5

export interface SensitivityCell {
  entryMultiple: number;
  exitMultiple: number;
  /** null when IRR is not meaningful (equity at exit ≤ 0). */
  irr: number | null;
  mom: number;
}

export interface SensitivityGrid {
  /** Row headers, ascending. */
  entryMultiples: number[];
  /** Column headers, ascending. */
  exitMultiples: number[];
  /** cells[row][col]; null where the multiples leave the allowed input range (blank cell). */
  cells: (SensitivityCell | null)[][];
}

// Keeps 8.3 − 1.0 at 7.3 rather than 7.300000000000001.
const tidy = (x: number) => Math.round(x * 1e6) / 1e6;

function axis(centre: number): number[] {
  const values: number[] = [];
  for (let k = -SENSITIVITY_HALF_WIDTH; k <= SENSITIVITY_HALF_WIDTH; k++) {
    values.push(tidy(centre + k * SENSITIVITY_STEP));
  }
  return values;
}

/**
 * IRR / MoM for entry × exit multiple, centred on the current case.
 * Each cell is a full re-run of the engine with only the two multiples changed,
 * so fees (a % of entry EV) and equity invested change with the entry multiple.
 */
export function sensitivityGrid(inputs: LboInputs): SensitivityGrid {
  const entryMultiples = axis(inputs.entryMultiple);
  const exitMultiples = axis(inputs.exitMultiple);

  const cells = entryMultiples.map((entryMultiple) =>
    exitMultiples.map((exitMultiple): SensitivityCell | null => {
      const scenario = { ...inputs, entryMultiple, exitMultiple };
      if (validateInputs(scenario).length > 0) return null;
      const { returns } = runLbo(scenario);
      return { entryMultiple, exitMultiple, irr: returns.irr, mom: returns.mom };
    }),
  );

  return { entryMultiples, exitMultiples, cells };
}
