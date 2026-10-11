import { describe, expect, it } from "vitest";
import {
  applyMultiples,
  editDraft,
  initialState,
  recentre,
  shiftWindow,
  stepDraft,
  tidyDraft,
} from "../calculatorState";
import { selectedPosition, windowGrid } from "../sensitivityView";

const base = initialState();
const anchorOf = (s: typeof base) => [s.anchor.entryMultiple, s.anchor.exitMultiple];
const multiplesOf = (s: typeof base) => [s.result.inputs.entryMultiple, s.result.inputs.exitMultiple];

describe("sensitivity grid: no re-centre on cell click", () => {
  it("applies the cell's multiples but keeps the window where it is", () => {
    const next = applyMultiples(base, 7.5, 8.5);
    expect(multiplesOf(next)).toEqual([7.5, 8.5]);
    expect(next.drafts.entryMultiple).toBe("7.5");
    expect(next.drafts.exitMultiple).toBe("8.5");
    expect(anchorOf(next)).toEqual([8, 8]);
  });

  it("moves only the selection outline: axes and positions stay put", () => {
    const before = windowGrid(base.result.inputs, base.anchor);
    const next = applyMultiples(base, 7.5, 8.5);
    const after = windowGrid(next.result.inputs, next.anchor);
    expect(after.entryMultiples).toEqual(before.entryMultiples);
    expect(after.exitMultiples).toEqual(before.exitMultiples);
    expect(selectedPosition(before, base.result.inputs)).toEqual([2, 2]);
    expect(selectedPosition(after, next.result.inputs)).toEqual([1, 3]);
  });

  it("keeps the shading reference: the centre cell's value doesn't change with the selection", () => {
    const next = applyMultiples(base, 7, 9);
    const centre = (s: typeof base) => windowGrid(s.result.inputs, s.anchor).cells[2][2]?.irr;
    expect(centre(next)).toBe(centre(base));
  });

  it("stays put over several clicks in a row", () => {
    const next = applyMultiples(applyMultiples(applyMultiples(base, 7, 7), 9, 9), 8.5, 7.5);
    expect(anchorOf(next)).toEqual([8, 8]);
  });
});

describe("sensitivity grid: re-centre on input change", () => {
  it("re-centres when the entry multiple is typed in the panel", () => {
    const next = editDraft(base, "entryMultiple", "9.5");
    expect(anchorOf(next)).toEqual([9.5, 8]);
  });

  it("re-centres when the exit multiple is stepped in the panel", () => {
    const next = stepDraft(base, "exitMultiple", 1);
    expect(anchorOf(next)).toEqual([8, 8.5]);
  });

  it("re-centres on the new case after a grid click, once the panel changes a multiple", () => {
    const clicked = applyMultiples(base, 7.5, 8.5);
    const next = stepDraft(clicked, "entryMultiple", -1);
    expect(anchorOf(next)).toEqual([7, 8.5]);
  });

  it("re-centres on Reset", () => {
    const moved = shiftWindow(applyMultiples(base, 7, 9), "exit", 1);
    expect(anchorOf(moved)).not.toEqual([8, 8]);
    expect(anchorOf(initialState())).toEqual([8, 8]);
  });

  it("doesn't re-centre for changes to other inputs", () => {
    const clicked = applyMultiples(base, 7.5, 8.5);
    const next = editDraft(clicked, "leverage", "4.0");
    expect(anchorOf(next)).toEqual([8, 8]);
  });

  it("doesn't re-centre while a multiple is invalid, then does once it is valid", () => {
    const typing = editDraft(base, "entryMultiple", "2"); // below the 3.0x minimum
    expect(typing.errors).not.toHaveLength(0);
    expect(anchorOf(typing)).toEqual([8, 8]);
    const done = editDraft(typing, "entryMultiple", "9");
    expect(anchorOf(done)).toEqual([9, 8]);
  });

  it("doesn't re-centre when blur only tidies the text (\"9\" → \"9.0\")", () => {
    const typed = editDraft(base, "entryMultiple", "9");
    const shifted = shiftWindow(typed, "entry", 1);
    const tidied = tidyDraft(shifted, "entryMultiple");
    expect(tidied.drafts.entryMultiple).toBe("9.0");
    expect(anchorOf(tidied)).toEqual(anchorOf(shifted));
  });

  it("Re-centre brings the selected case back to the middle", () => {
    const away = shiftWindow(shiftWindow(shiftWindow(base, "exit", 1), "exit", 1), "exit", 1);
    expect(selectedPosition(windowGrid(away.result.inputs, away.anchor), away.result.inputs)).toBeNull();
    const back = recentre(away);
    expect(anchorOf(back)).toEqual([8, 8]);
  });
});

describe("sensitivity grid: window shifting", () => {
  it("shifts by 0.5x without touching the inputs", () => {
    const next = shiftWindow(base, "exit", 1);
    expect(anchorOf(next)).toEqual([8, 8.5]);
    expect(multiplesOf(next)).toEqual([8, 8]);
    expect(next.result).toBe(base.result);
  });

  it("stops at the top of the range: the highest column shown is 20.0x", () => {
    let state = editDraft(base, "exitMultiple", "18.5");
    state = shiftWindow(state, "exit", 1);
    expect(anchorOf(state)).toEqual([8, 19]); // window 18.0 … 20.0
    const stuck = shiftWindow(state, "exit", 1);
    expect(stuck).toBe(state);
  });

  it("stops at the bottom of the range: the lowest row shown is 3.0x", () => {
    let state = editDraft(base, "leverage", "2.0");
    state = editDraft(state, "entryMultiple", "4.5");
    state = shiftWindow(state, "entry", -1);
    expect(anchorOf(state)).toEqual([4, 8]); // window 3.0 … 5.0
    expect(shiftWindow(state, "entry", -1)).toBe(state);
  });

  it("can move back towards the range from a window that hangs over the limit", () => {
    const state = editDraft(editDraft(base, "leverage", "1.0"), "entryMultiple", "3.0"); // window 2.0 … 4.0
    expect(shiftWindow(state, "entry", -1)).toBe(state);
    expect(anchorOf(shiftWindow(state, "entry", 1))).toEqual([3.5, 8]);
  });
});
