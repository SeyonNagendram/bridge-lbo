"use client";

import type { SVGProps } from "react";
import { useFlash } from "./useFlash";

/** A value label inside a chart: SVG text that gets the change highlight when its figure changes. */
export function ChartValue({ text, ...props }: { text: string } & SVGProps<SVGTextElement>) {
  const ref = useFlash<SVGTextElement>(text);
  return (
    <text ref={ref} {...props}>
      {text}
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
