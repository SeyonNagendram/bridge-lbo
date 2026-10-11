"use client";

import type { SVGProps } from "react";
import { useFlash } from "./useFlash";

/**
 * A value label inside a chart: SVG text that gets the change highlight when its figure changes.
 * `note` follows the figure in small muted text, e.g. a share: "27.1 · 55%".
 */
export function ChartValue({ text, note, ...props }: { text: string; note?: string | null } & SVGProps<SVGTextElement>) {
  const ref = useFlash<SVGTextElement>(note ? `${text}|${note}` : text);
  return (
    <text ref={ref} {...props}>
      {text}
      {note && <tspan className="fill-muted text-[11px] font-normal">{` \u00b7 ${note}`}</tspan>}
    </text>
  );
}

/** Legend key: a small square in a series colour beside its name. */
export function LegendKey({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block size-2.5 ${className}`} />
      {label}
    </span>
  );
}
