"use client";

import type { KeyboardEvent } from "react";
import type { InputKey, InputSpec } from "@/lib/lbo";

const UNIT_LABEL: Record<InputSpec["unit"], string> = {
  "€m": "€m",
  "%": "%",
  x: "x",
  years: "yrs",
};

// The visible unit sits outside the label, so screen readers get it spelled out here.
const UNIT_SPOKEN: Record<InputSpec["unit"], string> = {
  "€m": "in € millions",
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

const stepButton =
  "flex w-7 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-text";

export function NumberField({ field, spec, hint, draft, error, onDraftChange, onStep, onBlur }: NumberFieldProps) {
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="block">
            {spec.label}
            <span className="sr-only">, {UNIT_SPOKEN[spec.unit]}</span>
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
            className="w-14 bg-transparent text-right text-[16px] text-input lg:text-[14px]"
          />
          {/* Unit sits flush against the figure: "8.0x", not "8.0 x". */}
          <span aria-hidden="true" className="flex w-7 items-center text-[13px] text-muted">
            {UNIT_LABEL[spec.unit]}
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
