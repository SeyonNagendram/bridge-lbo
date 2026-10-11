// The calculator's state and every change to it, as pure functions (no React), so the rules about
// what re-centres the sensitivity grid are unit-tested. components/Calculator.tsx only wires them up.

import {
  BASE_CASE,
  INPUT_KEYS,
  INPUT_SPECS,
  calculate,
  type InputKey,
  type LboInputs,
  type LboResult,
  type ValidationError,
} from "./lbo";
import { formatInputValue, parseInputValue, stepInputValue } from "./format";
import { anchorOf, sameAnchor, shiftAnchor, type Axis, type Direction, type GridAnchor } from "./sensitivityView";

export type Drafts = Record<InputKey, string>;

export interface CalculatorState {
  /** Exactly what is typed in each field, valid or not. */
  drafts: Drafts;
  errors: ValidationError[];
  /** Last result from fully valid inputs; stays on screen while any field is invalid. */
  result: LboResult;
  /** Centre of the sensitivity grid's visible window. */
  anchor: GridAnchor;
}

function draftsFor(inputs: LboInputs): Drafts {
  const drafts = {} as Drafts;
  for (const key of INPUT_KEYS) drafts[key] = formatInputValue(inputs[key], INPUT_SPECS[key]);
  return drafts;
}

function parseDrafts(drafts: Drafts): LboInputs {
  const inputs = {} as LboInputs;
  for (const key of INPUT_KEYS) inputs[key] = parseInputValue(drafts[key], INPUT_SPECS[key]);
  return inputs;
}

/** The base case, with the grid centred on it. Also what Reset returns to. */
export function initialState(): CalculatorState {
  const outcome = calculate(BASE_CASE);
  if (!outcome.ok) throw new Error("Base case failed validation."); // guarded by the test suite
  return { drafts: draftsFor(BASE_CASE), errors: [], result: outcome.result, anchor: anchorOf(BASE_CASE) };
}

/** Recalculates from new drafts. The engine runs synchronously on every keystroke (well under 1 ms). */
function withDrafts(state: CalculatorState, drafts: Drafts): CalculatorState {
  const outcome = calculate(parseDrafts(drafts));
  return outcome.ok
    ? { ...state, drafts, errors: [], result: outcome.result }
    : { ...state, drafts, errors: outcome.errors };
}

/**
 * A change from the assumptions panel. If it moved the entry or exit multiple, the grid re-centres
 * on the new case; any other change keeps the window where it is.
 */
function fromPanel(state: CalculatorState, drafts: Drafts): CalculatorState {
  const next = withDrafts(state, drafts);
  const moved = !sameAnchor(anchorOf(next.result.inputs), anchorOf(state.result.inputs));
  return moved ? { ...next, anchor: anchorOf(next.result.inputs) } : next;
}

/** Typing in a field. */
export function editDraft(state: CalculatorState, field: InputKey, text: string): CalculatorState {
  return fromPanel(state, { ...state.drafts, [field]: text });
}

/** Stepper or ↑/↓ on a field: from what is typed if it's a number, otherwise from the last valid value. */
export function stepDraft(state: CalculatorState, field: InputKey, steps: number): CalculatorState {
  const spec = INPUT_SPECS[field];
  const typed = parseInputValue(state.drafts[field], spec);
  const from = Number.isFinite(typed) ? typed : state.result.inputs[field];
  return fromPanel(state, { ...state.drafts, [field]: formatInputValue(stepInputValue(from, spec, steps), spec) });
}

/** On leaving a field, tidy a valid entry into its standard form ("8" → "8.0"). */
export function tidyDraft(state: CalculatorState, field: InputKey): CalculatorState {
  if (state.errors.some((e) => e.field === field)) return state;
  const spec = INPUT_SPECS[field];
  const tidy = formatInputValue(parseInputValue(state.drafts[field], spec), spec);
  return tidy === state.drafts[field] ? state : fromPanel(state, { ...state.drafts, [field]: tidy });
}

/**
 * A sensitivity cell: sets both multiples, written into the fields as if typed. Never re-centres
 * the grid; only the selection outline moves.
 */
export function applyMultiples(state: CalculatorState, entryMultiple: number, exitMultiple: number): CalculatorState {
  return withDrafts(state, {
    ...state.drafts,
    entryMultiple: formatInputValue(entryMultiple, INPUT_SPECS.entryMultiple),
    exitMultiple: formatInputValue(exitMultiple, INPUT_SPECS.exitMultiple),
  });
}

/** Moves the grid's window one step along an axis; unchanged at the range limit. Inputs are untouched. */
export function shiftWindow(state: CalculatorState, axis: Axis, direction: Direction): CalculatorState {
  const anchor = shiftAnchor(state.anchor, axis, direction);
  return anchor === state.anchor ? state : { ...state, anchor };
}

/** Centres the grid on the selected case again. */
export function recentre(state: CalculatorState): CalculatorState {
  return { ...state, anchor: anchorOf(state.result.inputs) };
}
