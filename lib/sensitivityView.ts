// Presentation logic for the sensitivity grid: the diverging colour scale, keyboard movement and the
// visible window.
// Pure functions, no React, unit-tested like the engine.

import {
  INPUT_SPECS,
  SENSITIVITY_HALF_WIDTH,
  SENSITIVITY_STEP,
  sensitivityGrid,
  type LboInputs,
  type SensitivityCell,
  type SensitivityGrid,
} from "./lbo";

export type Metric = "irr" | "mom";

export interface Tone {
  /** Better (up) or worse (down) than the anchor cell; flat = same as displayed. */
  direction: "up" | "down" | "flat";
  /** 0–1: distance from the anchor cell relative to the furthest cell in the grid. */
  strength: number;
}

/** The value a cell shows for a metric; null = n.m. IRR. */
export function metricValue(cell: SensitivityCell, metric: Metric): number | null {
  return metric === "irr" ? cell.irr : cell.mom;
}

/** Differences smaller than this display identically (0.1pp for IRR, 0.01x for MoM), so stay neutral. */
const FLAT: Record<Metric, number> = { irr: 0.0005, mom: 0.005 };

/**
 * Diverging tone for every cell, measured against the grid's anchor (its middle cell), not the
 * selected case, so colours stay put when the selection moves. Strength is linear in the distance
 * from the anchor, scaled to the furthest cell, so the scale always uses its full range. An n.m. IRR is the worst possible outcome: full-strength down.
 * Blank cells (outside the allowed input range) stay null.
 */
export function gridTones(grid: SensitivityGrid, metric: Metric): (Tone | null)[][] {
  const mid = Math.floor(grid.cells.length / 2);
  const centreCell = grid.cells[mid]?.[mid];
  const centre = centreCell ? metricValue(centreCell, metric) : null;

  let maxDistance = 0;
  if (centre !== null) {
    for (const row of grid.cells) {
      for (const cell of row) {
        const value = cell ? metricValue(cell, metric) : null;
        if (value !== null) maxDistance = Math.max(maxDistance, Math.abs(value - centre));
      }
    }
  }

  return grid.cells.map((row) =>
    row.map((cell): Tone | null => {
      if (!cell) return null;
      const value = metricValue(cell, metric);
      if (centre === null) return { direction: "flat", strength: 0 }; // nothing to compare against
      if (value === null) return { direction: "down", strength: 1 };
      const diff = value - centre;
      if (Math.abs(diff) < FLAT[metric] || maxDistance === 0) return { direction: "flat", strength: 0 };
      return { direction: diff > 0 ? "up" : "down", strength: Math.abs(diff) / maxDistance };
    }),
  );
}

export type GridKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

const MOVES: Record<GridKey, { dr: number; dc: number; toEdge?: boolean }> = {
  ArrowUp: { dr: -1, dc: 0 },
  ArrowDown: { dr: 1, dc: 0 },
  ArrowLeft: { dr: 0, dc: -1 },
  ArrowRight: { dr: 0, dc: 1 },
  Home: { dr: 0, dc: -1, toEdge: true },
  End: { dr: 0, dc: 1, toEdge: true },
};

export function isGridKey(key: string): key is GridKey {
  return key in MOVES;
}

/**
 * Where focus goes from [row, col] for a key. Arrows move one cell, skipping blank cells;
 * Home / End jump to the first / last available cell in the row. At an edge, focus stays put.
 */
export function moveInGrid(
  available: boolean[][],
  [row, col]: [number, number],
  key: GridKey,
): [number, number] {
  const { dr, dc, toEdge } = MOVES[key];
  let target: [number, number] = [row, col];
  for (let r = row + dr, c = col + dc; available[r]?.[c] !== undefined; r += dr, c += dc) {
    if (available[r][c]) {
      target = [r, c];
      if (!toEdge) break;
    }
  }
  return target;
}

// ── Visible window ───────────────────────────────────────────────────────────
// The grid shows anchor ± 1.0x on both axes. The anchor moves only when the multiples are changed
// from the assumptions panel (or Reset), when the window is shifted, or on "Re-centre"; applying a
// cell from the grid itself leaves it where it is (see lib/calculatorState.ts).

export interface GridAnchor {
  entryMultiple: number;
  exitMultiple: number;
}

export type Axis = "entry" | "exit";
export type Direction = -1 | 1;

const AXIS_KEY = { entry: "entryMultiple", exit: "exitMultiple" } as const;

// Keeps 8.0 + 0.5 at 8.5 rather than 8.500000000000002.
const tidy = (x: number) => Math.round(x * 1e6) / 1e6;

export function anchorOf(inputs: LboInputs): GridAnchor {
  return { entryMultiple: inputs.entryMultiple, exitMultiple: inputs.exitMultiple };
}

export function sameAnchor(a: GridAnchor, b: GridAnchor): boolean {
  return Math.abs(a.entryMultiple - b.entryMultiple) < 1e-9 && Math.abs(a.exitMultiple - b.exitMultiple) < 1e-9;
}

/**
 * Whether the window can move one step along an axis: only while the row or column it would
 * bring into view is inside the allowed input range. A window already partly outside the range
 * (anchor near a limit) can still move back towards it.
 */
export function canShift(anchor: GridAnchor, axis: Axis, direction: Direction): boolean {
  const { min, max } = INPUT_SPECS[AXIS_KEY[axis]];
  const edge = tidy(anchor[AXIS_KEY[axis]] + direction * (SENSITIVITY_HALF_WIDTH + 1) * SENSITIVITY_STEP);
  return edge >= min - 1e-9 && edge <= max + 1e-9;
}

/** The anchor one step along an axis, or the same anchor at the range limit. */
export function shiftAnchor(anchor: GridAnchor, axis: Axis, direction: Direction): GridAnchor {
  if (!canShift(anchor, axis, direction)) return anchor;
  const key = AXIS_KEY[axis];
  return { ...anchor, [key]: tidy(anchor[key] + direction * SENSITIVITY_STEP) };
}

/** The grid for the visible window: current inputs, with the multiples taken from the anchor. */
export function windowGrid(inputs: LboInputs, anchor: GridAnchor): SensitivityGrid {
  return sensitivityGrid({ ...inputs, ...anchor });
}

/** Position of the selected case (the current inputs) in the window, or null when it is outside. */
export function selectedPosition(grid: SensitivityGrid, inputs: LboInputs): [number, number] | null {
  const row = grid.entryMultiples.findIndex((m) => Math.abs(m - inputs.entryMultiple) < 1e-9);
  const col = grid.exitMultiples.findIndex((m) => Math.abs(m - inputs.exitMultiple) < 1e-9);
  return row >= 0 && col >= 0 && grid.cells[row][col] ? [row, col] : null;
}

export type GridKeyAction =
  | { kind: "move"; to: [number, number] }
  | { kind: "shift"; axis: Axis; direction: Direction }
  | { kind: "none" };

// Rows run from low to high entry multiple, columns from low to high exit multiple.
const EDGE_SHIFT: Partial<Record<GridKey, { axis: Axis; direction: Direction }>> = {
  ArrowUp: { axis: "entry", direction: -1 },
  ArrowDown: { axis: "entry", direction: 1 },
  ArrowLeft: { axis: "exit", direction: -1 },
  ArrowRight: { axis: "exit", direction: 1 },
};

/**
 * What a key does from [row, col]: move to another cell, or, when an arrow has no cell left to
 * move to in its direction, shift the window that way by one step (if the range allows).
 */
export function gridKeyAction(
  available: boolean[][],
  anchor: GridAnchor,
  position: [number, number],
  key: GridKey,
): GridKeyAction {
  const to = moveInGrid(available, position, key);
  if (to[0] !== position[0] || to[1] !== position[1]) return { kind: "move", to };
  const shift = EDGE_SHIFT[key];
  if (shift && canShift(anchor, shift.axis, shift.direction)) return { kind: "shift", ...shift };
  return { kind: "none" };
}
