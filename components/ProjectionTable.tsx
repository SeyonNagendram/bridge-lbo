"use client";

import { useEffect, useRef } from "react";
import type { LboResult } from "@/lib/lbo";
import { projectionRows } from "@/lib/projection";
import { sectionTitle } from "./styles";
import { useFlash } from "./useFlash";

/**
 * Marks a horizontal scroll container with data-scrolled while it is scrolled away from the left edge
 * (shows the hairline beside the pinned column) and data-fade-right while there is more to the right
 * (see .scroll-fade-x in globals.css). Writes to the DOM directly: no re-renders on scroll.
 */
function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      element.toggleAttribute("data-scrolled", scrollLeft > 0);
      element.toggleAttribute("data-fade-right", scrollLeft + clientWidth < scrollWidth - 1);
      // In the tab order only while there is something to scroll, so keyboard users can reach the
      // hidden years with the arrow keys (Safari and Firefox don't focus scroll containers by themselves).
      element.tabIndex = scrollWidth > clientWidth + 1 ? 0 : -1;
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    // The container resizes with the viewport, the table with the holding period.
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return ref;
}

function FigureCell({ text, className }: { text: string; className: string }) {
  const ref = useFlash<HTMLTableCellElement>(text);
  return (
    <td ref={ref} className={`px-3 text-right whitespace-nowrap ${className}`}>
      {text}
    </td>
  );
}

// Pinned first column: sticky with the page background, so figures scroll underneath it.
// The hairline on its right edge appears only once the table has been scrolled.
const pinned =
  "sticky left-0 z-[1] bg-bg pr-4 text-left whitespace-nowrap after:absolute after:inset-y-0 after:right-0 after:hidden after:w-px after:bg-border group-data-[scrolled]/scroll:after:block";

export function ProjectionTable({ result }: { result: LboResult }) {
  const rows = projectionRows(result);
  const years = Array.from({ length: result.years.length + 1 }, (_, t) => t);
  const scrollRef = useScrollEdges<HTMLDivElement>();

  return (
    <section aria-labelledby="projection-title">
      <h2 id="projection-title" className={`${sectionTitle} mb-3`}>
        Projection
      </h2>
      {/* Scrolls horizontally inside its own container; the page itself never does. The wrapper draws
          the focus ring, which the fade's mask would clip on the scroll container itself. */}
      <div className="focus-ring-within">
        <div
          ref={scrollRef}
          role="region"
          aria-label="Projection table"
          className="group/scroll scroll-fade-x overflow-x-auto"
        >
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">
              Projection by year, Year 0 to Year {result.years.length}. Money in € millions; deductions in parentheses; a
              dash means exactly zero, and interest coverage shows a dash when there is no interest.
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={`${pinned} py-2 font-normal text-muted`}>
                  €m
                </th>
                {years.map((t) => (
                  <th key={t} scope="col" className="min-w-16 px-3 py-2 text-right font-medium whitespace-nowrap">
                    Year {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                // A new block (balance sheet, credit statistics) gets extra space above, not a rule.
                const padding = row.groupStart ? "pt-5 pb-1.5" : "py-1.5";
                // Ratios are set apart from the € figures: italic, muted.
                const tone = row.ratio ? "italic text-muted" : "";
                return (
                  <tr key={row.key} className={row.subtotal ? "border-t border-border font-medium" : undefined}>
                    <th
                      scope="row"
                      className={`${pinned} word ${padding} ${tone} ${row.subtotal ? "font-medium" : "font-normal"}`}
                    >
                      {row.label}
                    </th>
                    {row.cells.map((text, t) => (
                      <FigureCell key={t} text={text} className={`${padding} ${tone}`} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">Figures may not sum due to rounding.</p>
    </section>
  );
}
