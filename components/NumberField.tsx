"use client";

import type { KeyboardEvent } from "react";
import type { InputKey, InputSpec } from "@/lib/lbo";

// Unit shown beside the figure. Symbols (x, %) sit flush, words take a space ("5 years").
// Currency goes in the label instead ("Revenue, Year 0 (€m)"), so the field shows only "50.0".
const UNIT_BESIDE: Record<InputSpec["unit"], { text: string; spaced: boolean } | null> = {
  "€m": null,
  "%": { text: "%", spaced: false },
  x: { text: "x", spaced: false },
  years: { text: "years", spaced: true },
};

const UNIT_IN_LABEL: Partial<Record<InputSpec["unit"], string>> = { "€m": "(€m)" };

// The unit beside the field sits outside the label, so screen readers get it spelled out here.
const UNIT_SPOKEN: Partial<Record<InputSpec["unit"], string>> = {
  "%": "in percent",
  x: "as a multiple",
  years: "in years",
};

interface NumberFieldProps {
  field: InputKey;
  spec: InputSpec;
  hint?: string;
  draft: string;
  error?: string;
  onDraftChange: (field: InputKey, text: string) => void;
  /** Moves the value by `steps` stepper increments (negative = down). */
  onStep: (field: InputKey, steps: number) => void;
  onBlur: (field: InputKey) => void;
}

// 24px wide: the WCAG 2.2 minimum target size, and it leaves the labels room on one line.
const stepButton =
  "flex w-6 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-text";

export function NumberField({ field, spec, hint, draft, error, onDraftChange, onStep, onBlur }: NumberFieldProps) {
  const unitBeside = UNIT_BESIDE[spec.unit];
  const unitInLabel = UNIT_IN_LABEL[spec.unit];
  const unitSpoken = UNIT_SPOKEN[spec.unit];
  const id = `input-${field}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const steps = (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1);
    onStep(field, steps);
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label htmlFor={id} className="block">
            {spec.label}
            {unitInLabel && ` ${unitInLabel}`}
            {unitSpoken && <span className="sr-only">, {unitSpoken}</span>}
          </label>
          {hint && (
            <span id={hintId} className="block text-[12px] leading-4 text-muted">
              {hint}
            </span>
          )}
        </div>
        <div
          // field-group: focus ring on the whole group, see globals.css.
          className={`field-group flex h-9 shrink-0 overflow-hidden rounded-[6px] border bg-surface transition-colors duration-150 ${
            error ? "border-negative" : "border-border"
          }`}
        >
          {/* Steppers are for pointer users; keyboard users get ↑/↓ on the field, so they skip the tab order. */}
          <button type="button" tabIndex={-1} aria-label={`Decrease ${spec.label}`} className={stepButton} onClick={() => onStep(field, -1)}>
            −
          </button>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onDraftChange(field, event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => onBlur(field)}
            // 16px on small screens stops iOS Safari zooming in on focus.
            className="w-16 bg-transparent text-right text-[16px] text-input lg:w-14 lg:text-[14px]"
          />
          {/* Same-width unit slot on every field, so the figures line up in one column. */}
          <span
            aria-hidden="true"
            className={`flex w-10 items-center text-[13px] text-muted ${unitBeside?.spaced ? "pl-1" : ""}`}
          >
            {unitBeside?.text}
          </span>
          <button type="button" tabIndex={-1} aria-label={`Increase ${spec.label}`} className={stepButton} onClick={() => onStep(field, 1)}>
            +
          </button>
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-right text-[13px] text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
