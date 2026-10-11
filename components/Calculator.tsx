"use client";

import { useState } from "react";
import type { InputKey } from "@/lib/lbo";
import {
  applyMultiples,
  editDraft,
  initialState,
  recentre,
  shiftWindow,
  stepDraft,
  tidyDraft,
} from "@/lib/calculatorState";
import { dealSummary } from "@/lib/deal";
import type { Axis, Direction } from "@/lib/sensitivityView";
import { DebtChart } from "./DebtChart";
import { InputPanel } from "./InputPanel";
import { KpiTiles } from "./KpiTiles";
import { ProjectionTable } from "./ProjectionTable";
import { ReturnsWaterfall } from "./ReturnsWaterfall";
import { SensitivityGrid } from "./SensitivityGrid";
import { SourcesUses } from "./SourcesUses";

export function Calculator() {
  // All state changes are pure functions in lib/calculatorState.ts (unit-tested); this only wires them up.
  const [state, setState] = useState(initialState);

  const handleDraftChange = (field: InputKey, text: string) => setState((s) => editDraft(s, field, text));
  const handleStep = (field: InputKey, steps: number) => setState((s) => stepDraft(s, field, steps));
  const handleBlur = (field: InputKey) => setState((s) => tidyDraft(s, field));
  const handleReset = () => setState(initialState());
  const handleApplyMultiples = (entry: number, exit: number) => setState((s) => applyMultiples(s, entry, exit));
  const handleShift = (axis: Axis, direction: Direction) => setState((s) => shiftWindow(s, axis, direction));
  const handleRecentre = () => setState(recentre);

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

        {/* Sections in §5 order. */}
        <div className="min-w-0 space-y-12 lg:col-start-2 lg:row-start-2">
          <SourcesUses entry={state.result.entry} />
          <DebtChart result={state.result} />
          <ReturnsWaterfall result={state.result} />
          <SensitivityGrid
            inputs={state.result.inputs}
            anchor={state.anchor}
            onApply={handleApplyMultiples}
            onShift={handleShift}
            onRecentre={handleRecentre}
          />
          <ProjectionTable result={state.result} />
        </div>
      </div>
    </>
  );
}
