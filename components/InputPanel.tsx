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

/** Points down when collapsed, up when open. Flips instantly: §7 allows only colour/opacity transitions. */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className={`shrink-0 text-muted ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  // Confirms a reset to screen readers; every figure on the page changes, but silently otherwise.
  const [resetNote, setResetNote] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  function reset() {
    onReset();
    clearTimeout(resetTimer.current);
    setResetNote("Inputs reset to the base case.");
    resetTimer.current = setTimeout(() => setResetNote(""), 3000);
  }

  return (
    // Desktop: the header stays put and only the fields scroll, so the border and first field are
    // never clipped. The cap leaves room for the 24px sticky offset above and the page's 64px bottom
    // padding below, so the panel fits on screen in every scroll position, even when the page is short.
    <section
      aria-labelledby="assumptions-title"
      className="rounded-[6px] border border-border bg-surface lg:flex lg:max-h-[calc(100vh-96px)] lg:flex-col"
    >
      {/* Mobile: the whole header row is the toggle. Desktop: a plain heading, always expanded.
          The hairline under the header only shows while the body does, so a collapsed panel
          doesn't end in a double border. */}
      <h2
        id="assumptions-title"
        className={`shrink-0 border-border font-serif text-[15px] font-semibold lg:border-b ${open ? "border-b" : ""}`}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls="assumptions-body"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left lg:hidden"
        >
          Assumptions
          <ChevronIcon open={open} />
        </button>
        <span className="hidden px-4 py-3 lg:block">Assumptions</span>
      </h2>

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

      {/* Below the fields and outside the scroll area, so it's always reachable on desktop. */}
      <div className={`shrink-0 border-t border-border px-4 py-3 ${open ? "" : "hidden lg:block"}`}>
        <button
          type="button"
          onClick={reset}
          className="text-[13px] text-muted underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
        >
          Reset to base case
        </button>
        <span role="status" className="sr-only">
          {resetNote}
        </span>
      </div>
    </section>
  );
}
