// Deal-level presentation values derived from an LboResult: funding split, the one-line deal
// summary and the base-case comparison. Pure functions, no React, unit-tested like the engine.

import { BASE_CASE, INPUT_KEYS, type EntryValues, type LboInputs, type LboResult } from "./lbo";
import { formatMoney, formatMoM, formatMultiple, formatPercent } from "./format";

export interface FundingSplit {
  /** Exact shares of total sources (0–1), for drawing. */
  debtShare: number;
  equityShare: number;
  /** Whole percentages for labels; always sum to exactly 100. */
  debtPct: number;
  equityPct: number;
}

/** Debt vs equity as a share of total sources (debt + equity = EV + fees). */
export function fundingSplit(entry: EntryValues): FundingSplit {
  const total = entry.debt + entry.equity;
  const debtShare = total > 0 ? entry.debt / total : 0;
  const debtPct = Math.round(debtShare * 100);
  return { debtShare, equityShare: 1 - debtShare, debtPct, equityPct: 100 - debtPct };
}

/** True when every input matches the base case (within floating-point noise). */
export function isBaseCase(inputs: LboInputs): boolean {
  return INPUT_KEYS.every((key) => Math.abs(inputs[key] - BASE_CASE[key]) < 1e-9);
}

/** A run of summary text; `strong` runs are the key figures, set in medium weight. */
export interface SummarySegment {
  text: string;
  strong?: boolean;
}

/**
 * One sentence in the style of an investment memo's opening line, e.g.
 * "Acquire at 8.0x EBITDA (€80.0m), funded 61% debt / 39% equity; exit after 5 years at 8.0x → 20.6% IRR, 2.55x MoM."
 */
export function dealSummary(result: LboResult): SummarySegment[] {
  const { inputs, entry, returns } = result;
  const split = fundingSplit(entry);
  const years = inputs.holdingPeriod;

  const funding: SummarySegment[] =
    split.debtPct === 0
      ? [{ text: ", funded " }, { text: "entirely with equity", strong: true }]
      : [{ text: ", funded " }, { text: `${split.debtPct}% debt / ${split.equityPct}% equity`, strong: true }];

  return [
    { text: "Acquire at " },
    { text: `${formatMultiple(inputs.entryMultiple)} EBITDA`, strong: true },
    { text: " (" },
    { text: `€${formatMoney(entry.enterpriseValue)}m`, strong: true },
    { text: ")" },
    ...funding,
    { text: "; exit after " },
    { text: `${years} ${years === 1 ? "year" : "years"}`, strong: true },
    { text: " at " },
    { text: formatMultiple(inputs.exitMultiple), strong: true },
    { text: "\u00a0→ " }, // nbsp: the arrow never starts a line
    { text: `${returns.irr === null ? "n.m." : formatPercent(returns.irr)} IRR`, strong: true },
    { text: ", " },
    { text: `${formatMoM(returns.mom)} MoM`, strong: true },
    { text: "." },
  ];
}
