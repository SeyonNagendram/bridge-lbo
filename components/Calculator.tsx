"use client";

import { useEffect, useRef, useState } from "react";
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
import { dealSummary, isBaseCase } from "@/lib/deal";
import { inputsFromQuery, mergeScenarioQuery } from "@/lib/scenarioUrl";
import type { Axis, Direction } from "@/lib/sensitivityView";
import { CopyLink } from "./CopyLink";
import { DebtChart } from "./DebtChart";
import { InputPanel } from "./InputPanel";
import { KpiTiles } from "./KpiTiles";
import { ProjectionTable } from "./ProjectionTable";
import { ReturnsWaterfall } from "./ReturnsWaterfall";
import { SensitivityGrid } from "./SensitivityGrid";
import { SourcesUses } from "./SourcesUses";

/** How long the address bar waits for typing to pause before it follows the inputs. */
const URL_DELAY_MS = 300;

/** The page's own URL with the scenario in the query string, keeping any other parameters and the hash. */
function scenarioUrl(inputs: Parameters<typeof mergeScenarioQuery>[1]): string {
  const { origin, pathname, search, hash } = window.location;
  return `${origin}${pathname}${mergeScenarioQuery(search, inputs)}${hash}`;
}

export function Calculator() {
  // All state changes are pure functions in lib/calculatorState.ts (unit-tested); this only wires them up.
  const [state, setState] = useState(initialState);
  // Bumped once when a shared scenario is restored: remounts the outputs so they open on it without
  // the change highlight (which is for changes the reader makes, not for the page loading).
  const [restored, setRestored] = useState(0);
  const urlReady = useRef(false);

  // Shared scenario: the static page is rendered for the base case, so the query string can only be
  // read after hydration. Values that are missing or invalid fall back to the base case (lib/scenarioUrl.ts).
  useEffect(() => {
    const inputs = inputsFromQuery(window.location.search);
    urlReady.current = true;
    if (isBaseCase(inputs)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from the URL, which the server can't see
    setState(initialState(inputs));
    setRestored(1);
  }, []);

  // The address bar follows the inputs (the last valid result) once typing pauses: replaceState, so
  // no navigation, no history entry per keystroke, and no re-render.
  const inputs = state.result.inputs;
  useEffect(() => {
    if (!urlReady.current) return;
    const timer = setTimeout(() => {
      const url = scenarioUrl(inputs);
      if (url !== window.location.href) window.history.replaceState(null, "", url);
    }, URL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [inputs]);

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
      <div className="mb-8 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        {/* ~70ch and text-wrap: pretty, so the sentence breaks at natural points without orphans. */}
        <p className="max-w-[70ch] text-[15px] leading-6 text-pretty text-muted">
          {dealSummary(state.result).map((segment, i) =>
            segment.spoken ? (
              <span key={i}>
                <span aria-hidden="true">{segment.text}</span>
                <span className="sr-only">{segment.spoken}</span>
              </span>
            ) : segment.strong ? (
              <span key={i} className="font-medium text-text">
                {segment.text}
              </span>
            ) : (
              segment.text
            ),
          )}
        </p>
        <CopyLink link={() => scenarioUrl(state.result.inputs)} />
      </div>

      {/* Mobile: one column in DOM order (KPIs, assumptions, sections).
          Desktop: assumptions move into a sticky left column; KPIs and sections stack on the right. */}
      <div key={restored} className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
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
