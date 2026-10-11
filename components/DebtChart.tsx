"use client";

import type { LboResult } from "@/lib/lbo";
import { debtChart } from "@/lib/charts";
import { formatMoney } from "@/lib/format";
import { ChartValue, LegendKey } from "./ChartValue";
import { sectionTitle } from "./styles";

/** Space between a bar's top and its value label, and between two label lines. */
const LABEL_GAP = 6;
const LINE = 15;

/**
 * Debt at the end of each year, Year 0 to N, with excess cash as a separate segment on top once the
 * debt is repaid. Hand-built SVG (§2): x in % of the width, so text keeps its size at any width; all
 * geometry comes pre-rounded from lib/charts.ts. The SVG is decorative to screen readers, which get
 * the same figures as a table.
 */
export function DebtChart({ result }: { result: LboResult }) {
  const chart = debtChart(result);

  return (
    <section aria-labelledby="debt-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="debt-title" className={sectionTitle}>
          Debt paydown
        </h2>
        <p aria-hidden="true" className="flex gap-4 text-[12px] text-muted">
          {/* One series needs no legend; the key appears once cash gives the bars a second segment. */}
          {chart.hasCash && (
            <>
              <LegendKey label="Debt" className="bg-muted" />
              <LegendKey label="Cash" className="bg-positive" />
            </>
          )}
          <span>€m, year end</span>
        </p>
      </div>

      <svg aria-hidden="true" width="100%" height={chart.height} className="block overflow-visible text-[12px]">
        {chart.bars.map((bar) => (
          <g key={bar.year}>
            {bar.debtHeight > 0 && (
              <rect
                x={`${bar.x}%`}
                y={bar.debtY}
                width={`${bar.width}%`}
                height={bar.debtHeight}
                className="fill-muted"
                shapeRendering="crispEdges"
              />
            )}
            {bar.cashHeight > 0 && (
              <rect
                x={`${bar.x}%`}
                y={bar.cashY}
                width={`${bar.width}%`}
                height={bar.cashHeight}
                className="fill-positive"
                shapeRendering="crispEdges"
              />
            )}
            {/* Labels stack in the same order as the segments: cash (top) above debt. */}
            {bar.debtLabel && (
              <ChartValue
                text={bar.debtLabel}
                x={`${bar.centre}%`}
                y={bar.top - LABEL_GAP}
                textAnchor="middle"
                className="fill-text"
              />
            )}
            {bar.cashLabel && (
              <ChartValue
                text={bar.cashLabel}
                x={`${bar.centre}%`}
                y={bar.top - LABEL_GAP - (bar.debtLabel ? LINE : 0)}
                textAnchor="middle"
                className="fill-text"
              />
            )}
            <text x={`${bar.centre}%`} y={chart.baseline + 17} textAnchor="middle" className="fill-muted">
              {/* "Year" only where there is room; on a phone the slot is too narrow for "Year 7". */}
              <tspan className="hidden sm:inline">Year </tspan>
              {bar.year}
            </text>
          </g>
        ))}
        {/* Hairline baseline, drawn last so it sits on top of the bar ends. */}
        <line
          x1="0"
          x2="100%"
          y1={chart.baseline + 0.5}
          y2={chart.baseline + 0.5}
          className="stroke-border"
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      </svg>

      {/* sr-only on the wrapper: a table ignores the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Debt paydown: debt and cash at the end of each year, in € millions.</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Debt</th>
              <th scope="col">Cash</th>
            </tr>
          </thead>
          <tbody>
            {chart.bars.map((bar) => (
              <tr key={bar.year}>
                <th scope="row">Year {bar.year}</th>
                <td>{formatMoney(bar.debt)}</td>
                <td>{formatMoney(bar.cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
