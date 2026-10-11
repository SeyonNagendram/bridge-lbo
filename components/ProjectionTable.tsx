"use client";

import { useEffect, useRef } from "react";
import type { LboResult } from "@/lib/lbo";
import { projectionRows } from "@/lib/projection";
import { sectionTitle } from "./styles";
import { useFlash } from "./useFlash";

/**
 * Marks a horizontal scroll container with data-scrolled while it is scrolled away from the left
 * edge, which shows the hairline beside the pinned column. Writes to the DOM directly: no re-renders on scroll.
 */
function useScrolledX<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => element.toggleAttribute("data-scrolled", element.scrollLeft > 0);
    update();
    element.addEventListener("scroll", update, { passive: true });
    return () => element.removeEventListener("scroll", update);
  }, []);

  return ref;
}

function FigureCell({ text, padding }: { text: string; padding: string }) {
  const ref = useFlash<HTMLTableCellElement>(text);
  return (
    <td ref={ref} className={`px-3 text-right whitespace-nowrap ${padding}`}>
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
  const scrollRef = useScrolledX<HTMLDivElement>();

  return (
    <section aria-labelledby="projection-title">
      <h2 id="projection-title" className={`${sectionTitle} mb-3`}>
        Projection
      </h2>
      {/* Scrolls horizontally inside its own container; the page itself never does. */}
      <div ref={scrollRef} className="group/scroll overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">
            Projection by year, Year 0 to Year {result.years.length}. Money in € millions; deductions in parentheses.
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
              return (
                <tr key={row.key} className={row.subtotal ? "border-t border-border font-medium" : undefined}>
                  <th scope="row" className={`${pinned} ${padding} ${row.subtotal ? "font-medium" : "font-normal"}`}>
                    {row.label}
                  </th>
                  {row.cells.map((text, t) => (
                    <FigureCell key={t} text={text} padding={padding} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
