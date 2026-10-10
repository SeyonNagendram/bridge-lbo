"use client";

import { useEffect, useRef, useState } from "react";
import { INPUT_SPECS, type InputKey, type ValidationError } from "@/lib/lbo";
import { NumberField } from "./NumberField";
import { sectionTitle } from "./styles";

// Grouped exactly as in §3. Hints carry the basis of each percentage or multiple.
const GROUPS: { title: string; fields: { key: InputKey; hint?: string }[] }[] = [
  {
    title: "Transaction",
    fields: [
      { key: "revenue0" },
      { key: "ebitdaMargin" },
      { key: "entryMultiple", hint: "x EBITDA" },
      { key: "leverage", hint: "x EBITDA" },
      { key: "feePct", hint: "% of EV" },
    ],
  },
  {
    title: "Operations",
    fields: [
      { key: "revenueGrowth" },
      { key: "interestRate" },
      { key: "taxRate" },
      { key: "capexPct", hint: "% of revenue" },
      { key: "daPct", hint: "% of revenue" },
      { key: "nwcPct", hint: "% of revenue change" },
    ],
  },
  {
    title: "Exit",
    fields: [{ key: "exitMultiple", hint: "x EBITDA" }, { key: "holdingPeriod" }],
  },
];

/**
 * Marks a scroll container with data-fade-top / data-fade-bottom while there is more content in
 * that direction (see .scroll-fade in globals.css). Writes to the DOM directly: no re-renders on scroll.
 */
function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      element.toggleAttribute("data-fade-top", scrollTop > 1);
      element.toggleAttribute("data-fade-bottom", scrollTop + clientHeight < scrollHeight - 1);
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return ref;
}

interface InputPanelProps {
  drafts: Record<InputKey, string>;
  errors: ValidationError[];
  onDraftChange: (field: InputKey, text: string) => void;
  onStep: (field: InputKey, steps: number) => void;
  onBlur: (field: InputKey) => void;
  onReset: () => void;
}

export function InputPanel({ drafts, errors, onDraftChange, onStep, onBlur, onReset }: InputPanelProps) {
  // Collapsible on mobile only (open on first load); always expanded on desktop.
  const [open, setOpen] = useState(true);
  const bodyRef = useScrollFade<HTMLDivElement>();

  return (
    // Desktop: the header stays put and only the fields scroll, so the border and first field are
    // never clipped. The cap leaves room for the 24px sticky offset above and the page's 64px bottom
    // padding below, so the panel fits on screen in every scroll position, even when the page is short.
    <section
      aria-labelledby="assumptions-title"
      className="rounded-[6px] border border-border bg-surface lg:flex lg:max-h-[calc(100vh-96px)] lg:flex-col"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
        <h2 id="assumptions-title" className="font-serif text-[15px] font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="assumptions-body"
            onClick={() => setOpen((value) => !value)}
            className="flex items-baseline gap-2 lg:hidden"
          >
            Assumptions
            <span className="font-sans text-[13px] font-normal text-muted">{open ? "Hide" : "Show"}</span>
          </button>
          <span className="hidden lg:inline">Assumptions</span>
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[13px] text-muted underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
        >
          Reset to base case
        </button>
      </div>

      <div
        id="assumptions-body"
        ref={bodyRef}
        // relative: contains the absolutely positioned sr-only labels, which would otherwise
        // stretch the page from their offscreen position inside the scrolled list.
        className={`scroll-fade relative px-4 pb-2 lg:min-h-0 lg:overflow-y-auto ${open ? "" : "hidden lg:block"}`}
      >
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="border-b border-border pb-2 last:border-b-0">
            <legend className={`${sectionTitle} pt-4`}>{group.title}</legend>
            {group.fields.map(({ key, hint }) => (
              <NumberField
                key={key}
                field={key}
                spec={INPUT_SPECS[key]}
                hint={hint}
                draft={drafts[key]}
                error={errors.find((e) => e.field === key)?.message}
                onDraftChange={onDraftChange}
                onStep={onStep}
                onBlur={onBlur}
              />
            ))}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
