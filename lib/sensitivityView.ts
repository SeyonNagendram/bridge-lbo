// Presentation logic for the sensitivity grid: the diverging colour scale and keyboard movement.
// Pure functions, no React, unit-tested like the engine.

import type { SensitivityCell, SensitivityGrid } from "./lbo";

export type Metric = "irr" | "mom";

export interface Tone {
  /** Better (up) or worse (down) than the current case; flat = same as displayed. */
  direction: "up" | "down" | "flat";
  /** 0–1: distance from the current case relative to the furthest cell in the grid. */
  strength: number;
}

/** The value a cell shows for a metric; null = n.m. IRR. */
export function metricValue(cell: SensitivityCell, metric: Metric): number | null {
  return metric === "irr" ? cell.irr : cell.mom;
}

/** Differences smaller than this display identically (0.1pp for IRR, 0.01x for MoM), so stay neutral. */
const FLAT: Record<Metric, number> = { irr: 0.0005, mom: 0.005 };

/**
 * Diverging tone for every cell, centred on the current case (the middle cell, by construction of
 * the grid). Strength is linear in the distance from the current case, scaled to the furthest cell,
 * so the scale always uses its full range. An n.m. IRR is the worst possible outcome: full-strength down.
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
