import { describe, expect, it } from "vitest";
import { gridKeyAction, gridTones, moveInGrid } from "../sensitivityView";
import { BASE_CASE, sensitivityGrid } from "../lbo";

describe("gridTones", () => {
  const grid = sensitivityGrid(BASE_CASE);
  const irr = gridTones(grid, "irr");

  it("is neutral at the current case", () => {
    expect(irr[2][2]).toEqual({ direction: "flat", strength: 0 });
  });

  it("diverges: better cells up, worse cells down, on one square-root scale", () => {
    // Entry 7.0x / exit 9.0x is the best cell (34.5%), entry 9.0x / exit 7.0x the worst (10.0%).
    expect(irr[0][4]).toEqual({ direction: "up", strength: 1 });
    expect(irr[4][0]?.direction).toBe("down");
    expect(irr[4][0]?.strength).toBeCloseTo(Math.sqrt((0.2062 - 0.1) / (0.345 - 0.2062)), 1);
    for (const row of irr) for (const tone of row) expect(tone!.strength).toBeGreaterThanOrEqual(0);
  });

  it("uses one symmetric scale: the smaller side never reaches full strength", () => {
    // The best cell is further from the centre (+13.9pp) than the worst (−10.6pp), so red stays below 1.
    const strongestDown = Math.max(...irr.flat().filter((t) => t!.direction === "down").map((t) => t!.strength));
    expect(strongestDown).toBeLessThan(1);
    expect(strongestDown).toBeCloseTo(Math.sqrt(0.106 / 0.139), 1);
  });

  it("lifts mid-range cells with the square-root curve, keeping their order", () => {
    const grid = sensitivityGrid(BASE_CASE);
    const ups = grid.cells
      .flat()
      .map((cell, i) => ({ irr: cell!.irr!, strength: irr.flat()[i]!.strength, up: irr.flat()[i]!.direction === "up" }))
      .filter((c) => c.up)
      .sort((a, b) => a.irr - b.irr);
    for (let i = 1; i < ups.length; i++) expect(ups[i].strength).toBeGreaterThanOrEqual(ups[i - 1].strength);
  });

  it("maps distance to strength with a square root, the same on both sides", () => {
    // Synthetic grid: centre 20%, best +10pp, others at a quarter of that distance either way.
    const values = [
      [0.3, 0.225, 0.2, 0.2, 0.2],
      [0.2, 0.2, 0.2, 0.2, 0.2],
      [0.2, 0.2, 0.2, 0.2, 0.2],
      [0.2, 0.2, 0.2, 0.2, 0.2],
      [0.2, 0.2, 0.2, 0.2, 0.175],
    ];
    const grid = {
      entryMultiples: [7, 7.5, 8, 8.5, 9],
      exitMultiples: [7, 7.5, 8, 8.5, 9],
      cells: values.map((row, r) => row.map((irr, c) => ({ entryMultiple: 7 + r / 2, exitMultiple: 7 + c / 2, irr, mom: 2 }))),
    };
    const tones = gridTones(grid, "irr");
    expect(tones[0][0]).toEqual({ direction: "up", strength: 1 });
    expect(tones[0][1]?.strength).toBeCloseTo(0.5, 9); // √0.25
    expect(tones[4][4]?.direction).toBe("down");
    expect(tones[4][4]?.strength).toBeCloseTo(tones[0][1]!.strength, 9);
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

describe("gridKeyAction", () => {
  const all = Array.from({ length: 5 }, () => Array(5).fill(true) as boolean[]);
  const anchor = { entryMultiple: 8, exitMultiple: 8 };

  it("moves inside the grid", () => {
    expect(gridKeyAction(all, anchor, [2, 2], "ArrowLeft")).toEqual({ kind: "move", to: [2, 1] });
  });

  it("shifts the window at the edge, in the arrow's direction", () => {
    expect(gridKeyAction(all, anchor, [0, 2], "ArrowUp")).toEqual({ kind: "shift", axis: "entry", direction: -1 });
    expect(gridKeyAction(all, anchor, [4, 2], "ArrowDown")).toEqual({ kind: "shift", axis: "entry", direction: 1 });
    expect(gridKeyAction(all, anchor, [2, 0], "ArrowLeft")).toEqual({ kind: "shift", axis: "exit", direction: -1 });
    expect(gridKeyAction(all, anchor, [2, 4], "ArrowRight")).toEqual({ kind: "shift", axis: "exit", direction: 1 });
  });

  it("does nothing at the edge when the range limit is reached", () => {
    expect(gridKeyAction(all, { entryMultiple: 8, exitMultiple: 19 }, [2, 4], "ArrowRight")).toEqual({ kind: "none" });
    expect(gridKeyAction(all, { entryMultiple: 4, exitMultiple: 8 }, [0, 2], "ArrowUp")).toEqual({ kind: "none" });
  });

  it("never shifts on Home / End", () => {
    expect(gridKeyAction(all, anchor, [2, 4], "End")).toEqual({ kind: "none" });
  });
});
