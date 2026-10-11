// Rows of the projection table (§5), as display strings for Year 0 … N. Pure functions, no React,
// unit-tested like the engine. Deductions (D&A, interest, tax, capex, ΔNWC) are shown as negatives in
// parentheses, banking-style, so the P&L and the cash flow build each read top to bottom as a sum.

import type { LboResult, ProjectionYear } from "./lbo";
import { formatMoney, formatMultiple, formatPercent } from "./format";

export interface ProjectionRow {
  key: string;
  label: string;
  /** Subtotal rows (EBITDA, EBIT, Net income, FCF): medium weight with a hairline above. */
  subtotal?: boolean;
  /** Ratio rows (margin, leverage, coverage): italic and muted, so they don't read as € figures. */
  ratio?: boolean;
  /** First row of a new block (balance sheet, credit statistics): extra space above. */
  groupStart?: boolean;
  /** One string per column, Year 0 first. "" where a figure doesn't exist (flows in Year 0). */
  cells: string[];
}

/** Not applicable: flows have no Year 0 value; the table leaves the cell empty. */
const NONE = "";

/** An exact zero (e.g. cash while debt is still being repaid) shows as an en dash, banking-style. */
export const ZERO = "\u2013";

const orDash = (value: number, format: (value: number) => string) => (value === 0 ? ZERO : format(value));

type Column = { year0: string; year: (y: ProjectionYear) => string };

const money = (pick: (y: ProjectionYear) => number, year0: number | null, sign = 1): Column => ({
  year0: year0 === null ? NONE : orDash(sign * year0, formatMoney),
  year: (y) => orDash(sign * pick(y), formatMoney),
});

export function projectionRows(result: LboResult): ProjectionRow[] {
  const { entry, years, inputs } = result;
  const row = (key: string, label: string, column: Column, extra: Partial<ProjectionRow> = {}): ProjectionRow => ({
    key,
    label,
    cells: [column.year0, ...years.map(column.year)],
    ...extra,
  });

  return [
    row("revenue", "Revenue", money((y) => y.revenue, entry.revenue)),
    row("ebitda", "EBITDA", money((y) => y.ebitda, entry.ebitda), { subtotal: true }),
    row("ebitdaMargin", "EBITDA margin", {
      year0: formatPercent(inputs.ebitdaMargin),
      year: (y) => formatPercent(y.ebitdaMargin),
    }, { ratio: true }),
    row("da", "D&A", money((y) => y.da, null, -1)),
    row("ebit", "EBIT", money((y) => y.ebit, null), { subtotal: true }),
    row("interest", "Interest", money((y) => y.interest, null, -1)),
    row("ebt", "EBT", money((y) => y.ebt, null)),
    row("tax", "Tax", money((y) => y.tax, null, -1)),
    row("netIncome", "Net income", money((y) => y.netIncome, null), { subtotal: true }),
    // Non-cash, so added back: the cash flow block then foots, Net income + D&A − Capex − ΔNWC = FCF.
    row("daAddBack", "D&A (add-back)", money((y) => y.da, null)),
    row("capex", "Capex", money((y) => y.capex, null, -1)),
    row("changeInNwc", "ΔNWC", money((y) => y.changeInNwc, null, -1)),
    row("fcf", "FCF", money((y) => y.fcf, null), { subtotal: true }),
    row("debt", "Debt (end of year)", money((y) => y.debt, entry.debt), { groupStart: true }),
    row("cash", "Cash", money((y) => y.cash, entry.cash)),
    row(
      "leverage",
      "Leverage",
      { year0: orDash(entry.leverage, formatMultiple), year: (y) => orDash(y.leverage, formatMultiple) },
      { groupStart: true, ratio: true },
    ),
    row("interestCoverage", "Interest coverage", {
      year0: NONE,
      year: (y) => (y.interestCoverage === null ? "—" : formatMultiple(y.interestCoverage)),
    }, { ratio: true }),
  ];
}
