"use client";

import type { LboResult } from "@/lib/lbo";
import { bridgeChart, type BridgeKind } from "@/lib/charts";
import { ChartValue } from "./ChartValue";
import { sectionTitle } from "./styles";

const ROW = 32;
const BAR = 20;
/** Bar's top within its row. */
const INSET = (ROW - BAR) / 2;

const FILL: Record<BridgeKind, string> = {
  // Grey = capital (as the debt bars), green / red = the value drivers.
  total: "fill-muted",
  increase: "fill-positive",
  decrease: "fill-negative",
};

/**
 * Returns attribution (§4 bridge) as a horizontal waterfall, equity invested to equity at exit. Category
 * names are an HTML column beside the SVG, on the same 32px rows, so they keep a fixed width while the
 * bars fill the rest; value labels run into reserved padding on the right. Figures come from
 * lib/charts.ts, each rounded on its own like the projection table; the bars use exact values.
 */
export function ReturnsWaterfall({ result }: { result: LboResult }) {
  const { steps, zero } = bridgeChart(result);
  const height = steps.length * ROW;

  return (
    <section aria-labelledby="attribution-title">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="attribution-title" className={sectionTitle}>
          Returns attribution
        </h2>
        <p aria-hidden="true" className="text-[12px] text-muted">
          €m
        </p>
      </div>

      <div aria-hidden="true" className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 text-[13px]">
        <ul>
          {steps.map((step) => (
            <li
              key={step.key}
              // .word: normal figures, so "build-up" doesn't read "build - up" (see globals.css).
              className={`word flex h-8 items-center ${step.kind === "total" ? "font-medium" : "text-muted"}`}
            >
              {step.label}
            </li>
          ))}
        </ul>
        {/* pr: room for the value label after the longest bar, e.g. "1,234.5 · 55%". */}
        <div className="pr-24">
          <svg width="100%" height={height} className="block overflow-visible text-[12px]">
            {/* Hairline at zero: the totals start here. */}
            <line
              x1={`${zero}%`}
              x2={`${zero}%`}
              y1={0}
              y2={height}
              className="stroke-border"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            {steps.map((step, i) => {
              const left = Math.min(step.start, step.end);
              const width = Math.abs(step.end - step.start);
              const y = i * ROW + INSET;
              const next = steps[i + 1];
              return (
                <g key={step.key}>
                  {width > 0 && (
                    <rect
                      x={`${left}%`}
                      y={y}
                      width={`${width}%`}
                      height={BAR}
                      className={FILL[step.kind]}
                      shapeRendering="crispEdges"
                    />
                  )}
                  {/* Connector from this bar's end to the next bar, which starts (or, for the exit
                      total, ends) at the same running total. */}
                  {next && (
                    <line
                      x1={`${step.end}%`}
                      x2={`${step.end}%`}
                      y1={y + BAR}
                      y2={y + ROW}
                      className="stroke-muted"
                      strokeWidth={1}
                    />
                  )}
                  <ChartValue
                    text={step.text}
                    note={step.shareText}
                    x={`${Math.max(step.start, step.end)}%`}
                    dx={6}
                    y={i * ROW + ROW / 2}
                    dy="0.35em"
                    className={step.kind === "total" ? "fill-text font-medium" : "fill-text"}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">Figures may not sum due to rounding.</p>

      {/* sr-only on the wrapper: a table ignores the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Returns attribution: from equity invested to equity at exit, in € millions.</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">€m</th>
              <th scope="col">Share of value created</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.key}>
                <th scope="row">{step.label}</th>
                <td>{step.text}</td>
                <td>{step.shareText ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
