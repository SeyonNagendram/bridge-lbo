import { describe, expect, it } from "vitest";
import { gridTones, moveInGrid } from "../sensitivityView";
import { BASE_CASE, sensitivityGrid } from "../lbo";

describe("gridTones", () => {
  const grid = sensitivityGrid(BASE_CASE);
  const irr = gridTones(grid, "irr");

  it("is neutral at the current case", () => {
    expect(irr[2][2]).toEqual({ direction: "flat", strength: 0 });
  });

  it("diverges: better cells up, worse cells down, scaled to the furthest cell", () => {
    // Entry 7.0x / exit 9.0x is the best cell (34.5%), entry 9.0x / exit 7.0x the worst (10.0%).
    expect(irr[0][4]).toEqual({ direction: "up", strength: 1 });
    expect(irr[4][0]?.direction).toBe("down");
    expect(irr[4][0]?.strength).toBeCloseTo((0.2062 - 0.1) / (0.345 - 0.2062), 1);
    for (const row of irr) for (const tone of row) expect(tone!.strength).toBeGreaterThanOrEqual(0);
  });

  it("uses MoM when asked", () => {
    const mom = gridTones(grid, "mom");
    expect(mom[2][2]?.direction).toBe("flat");
    expect(mom[0][4]?.direction).toBe("up");
  });

  it("keeps blank cells blank and treats n.m. IRR as the worst outcome", () => {
    // Entry 3.5x: the 2.5x and 3.0x... rows fall outside the range or below leverage → blank.
    const low = sensitivityGrid({ ...BASE_CASE, entryMultiple: 3.5, leverage: 2.5, exitMultiple: 3.5 });
    const tones = gridTones(low, "irr");
    expect(low.cells[0][0]).toBeNull();
    expect(tones[0][0]).toBeNull();

    const wiped = sensitivityGrid({ ...BASE_CASE, leverage: 7, interestRate: 0.2, exitMultiple: 4 });
    const wipedTones = gridTones(wiped, "irr");
    wiped.cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell && cell.irr === null && wiped.cells[2][2]?.irr !== null) {
          expect(wipedTones[r][c]).toEqual({ direction: "down", strength: 1 });
        }
      }),
    );
  });
});

describe("moveInGrid", () => {
  const all = Array.from({ length: 5 }, () => Array(5).fill(true) as boolean[]);

  it("moves one cell with the arrows and stops at the edges", () => {
    expect(moveInGrid(all, [2, 2], "ArrowUp")).toEqual([1, 2]);
    expect(moveInGrid(all, [2, 2], "ArrowRight")).toEqual([2, 3]);
    expect(moveInGrid(all, [0, 0], "ArrowUp")).toEqual([0, 0]);
    expect(moveInGrid(all, [4, 4], "ArrowRight")).toEqual([4, 4]);
  });

  it("jumps to the ends of the row with Home / End", () => {
    expect(moveInGrid(all, [2, 2], "Home")).toEqual([2, 0]);
    expect(moveInGrid(all, [2, 2], "End")).toEqual([2, 4]);
  });

  it("skips blank cells", () => {
    const holes = all.map((row) => [...row]);
    holes[1][2] = false;
    holes[2][0] = false;
    expect(moveInGrid(holes, [2, 2], "ArrowUp")).toEqual([0, 2]);
    expect(moveInGrid(holes, [2, 2], "Home")).toEqual([2, 1]);
    holes[0][2] = false;
    expect(moveInGrid(holes, [2, 2], "ArrowUp")).toEqual([2, 2]);
  });
});
