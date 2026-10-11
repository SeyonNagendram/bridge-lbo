"use client";

import { useState } from "react";
import {
  BASE_CASE,
  INPUT_KEYS,
  INPUT_SPECS,
  calculate,
  type InputKey,
  type LboInputs,
  type LboResult,
  type ValidationError,
} from "@/lib/lbo";
import { dealSummary } from "@/lib/deal";
import { formatInputValue, parseInputValue, stepInputValue } from "@/lib/format";
import { InputPanel } from "./InputPanel";
import { KpiTiles } from "./KpiTiles";
import { ProjectionTable } from "./ProjectionTable";
import { SensitivityGrid } from "./SensitivityGrid";
import { SourcesUses } from "./SourcesUses";

type Drafts = Record<InputKey, string>;

interface CalculatorState {
  /** Exactly what is typed in each field, valid or not. */
  drafts: Drafts;
  errors: ValidationError[];
  /** Last result from fully valid inputs; stays on screen while any field is invalid. */
  result: LboResult;
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

function initialState(): CalculatorState {
  const outcome = calculate(BASE_CASE);
  if (!outcome.ok) throw new Error("Base case failed validation."); // guarded by the test suite
  return { drafts: draftsFor(BASE_CASE), errors: [], result: outcome.result };
}

/** Recalculates from new drafts. The engine runs synchronously on every keystroke (well under 1 ms). */
function withDrafts(state: CalculatorState, drafts: Drafts): CalculatorState {
  const outcome = calculate(parseDrafts(drafts));
  return outcome.ok
    ? { drafts, errors: [], result: outcome.result }
    : { drafts, errors: outcome.errors, result: state.result };
}

export function Calculator() {
  const [state, setState] = useState(initialState);

  function handleDraftChange(field: InputKey, text: string) {
    setState((s) => withDrafts(s, { ...s.drafts, [field]: text }));
  }

  function handleStep(field: InputKey, steps: number) {
    setState((s) => {
      const spec = INPUT_SPECS[field];
      const typed = parseInputValue(s.drafts[field], spec);
      // Step from what is typed if it's a number, otherwise from the last valid value.
      const from = Number.isFinite(typed) ? typed : s.result.inputs[field];
      const next = stepInputValue(from, spec, steps);
      return withDrafts(s, { ...s.drafts, [field]: formatInputValue(next, spec) });
    });
  }

  // On leaving a field, tidy a valid entry into its standard form ("8" → "8.0").
  function handleBlur(field: InputKey) {
    setState((s) => {
      if (s.errors.some((e) => e.field === field)) return s;
      const spec = INPUT_SPECS[field];
      const tidy = formatInputValue(parseInputValue(s.drafts[field], spec), spec);
      return tidy === s.drafts[field] ? s : withDrafts(s, { ...s.drafts, [field]: tidy });
    });
  }

  // A sensitivity cell sets both multiples at once, written into the fields as if typed.
  function handleApplyMultiples(entryMultiple: number, exitMultiple: number) {
    setState((s) =>
      withDrafts(s, {
        ...s.drafts,
        entryMultiple: formatInputValue(entryMultiple, INPUT_SPECS.entryMultiple),
        exitMultiple: formatInputValue(exitMultiple, INPUT_SPECS.exitMultiple),
      }),
    );
  }

  function handleReset() {
    setState(initialState());
  }

  const stale = state.errors.length > 0;

  return (
    <>
      {/* The deal in one sentence, like a memo's opening line; follows the last valid result. */}
      <div className="mb-8 border-b border-border pb-6">
        {/* ~70ch and text-wrap: pretty, so the sentence breaks at natural points without orphans. */}
        <p className="max-w-[70ch] text-[15px] leading-6 text-pretty text-muted">
          {dealSummary(state.result).map((segment, i) =>
            segment.strong ? (
              <span key={i} className="font-medium text-text">
                {segment.text}
              </span>
            ) : (
              segment.text
            ),
          )}
        </p>
      </div>

      {/* Mobile: one column in DOM order (KPIs, assumptions, sections).
          Desktop: assumptions move into a sticky left column; KPIs and sections stack on the right. */}
      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <KpiTiles result={state.result} />
          {/* Always mounted so screen readers announce the message when it appears. */}
          <p role="status">
            {stale && (
              <span className="mt-2 block text-[13px] text-negative">
                Some inputs are invalid. Showing the last valid result.
              </span>
            )}
          </p>
        </div>

        <aside className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-6">
            <InputPanel
              drafts={state.drafts}
              errors={state.errors}
              onDraftChange={handleDraftChange}
              onStep={handleStep}
              onBlur={handleBlur}
              onReset={handleReset}
            />
          </div>
        </aside>

        {/* Sections in §5 order (charts follow in Phase 3, between Sources & Uses and Sensitivity). */}
        <div className="min-w-0 space-y-12 lg:col-start-2 lg:row-start-2">
          <SourcesUses entry={state.result.entry} />
          <SensitivityGrid inputs={state.result.inputs} onApply={handleApplyMultiples} />
          <ProjectionTable result={state.result} />
        </div>
      </div>
    </>
  );
}
