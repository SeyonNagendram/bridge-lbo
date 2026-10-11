// The warnings line under the KPI tiles (§4): one short phrase per engine warning, each naming the
// years it applies to. Pure functions, no React, unit-tested like the engine.

import { LOW_COVERAGE_THRESHOLD, type LboResult, type LboWarning } from "./lbo";
import { formatMultiple } from "./format";

/**
 * Years as a compact list: [3] → "Year 3", [1, 2, 3, 5] → "Years 1–3, 5", [4, 5] → "Years 4–5".
 * Consecutive years collapse into a range, so a seven-year shortfall stays short.
 */
export function formatYears(years: number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(j > i ? `${sorted[i]}–${sorted[j]}` : `${sorted[i]}`);
    i = j + 1;
  }
  // nbsp: "Year" never ends a line apart from its number.
  return `${sorted.length === 1 ? "Year" : "Years"}\u00a0${runs.join(", ")}`;
}

function warningText(warning: LboWarning): string {
  const years = formatYears(warning.years);
  switch (warning.kind) {
    case "cashShortfall":
      return `Cash shortfall in ${years}, funded with extra debt`;
    case "lowInterestCoverage":
      return `Interest coverage below ${formatMultiple(LOW_COVERAGE_THRESHOLD)} in ${years}`;
    case "irrNotMeaningful":
      return `IRR not meaningful: equity at exit is zero or negative (${years})`;
  }
}

/** One phrase per warning, in the engine's order (shortfall, coverage, IRR); empty when there are none. */
export function warningLines(result: LboResult): string[] {
  return result.warnings.map(warningText);
}
