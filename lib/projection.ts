// Rows of the projection table (§5), as display strings for Year 0 … N. Pure functions, no React,
// unit-tested like the engine. Deductions (D&A, interest, tax, capex, ΔNWC) are shown as negatives in
// parentheses, banking-style, so the P&L reads top to bottom as a subtraction.

import type { LboResult, ProjectionYear } from "./lbo";
import { formatMoney, formatMultiple, formatPercent } from "./format";

export interface ProjectionRow {
  key: string;
  label: string;
  /** Subtotal rows (EBITDA, EBIT, Net income, FCF): medium weight with a hairline above. */
  subtotal?: boolean;
  /** First row of a new block (balance sheet, credit statistics): extra space above. */
  groupStart?: boolean;
  /** One string per column, Year 0 first. "" where a figure doesn't exist (flows in Year 0). */
  cells: string[];
}

/** Not applicable: flows have no Year 0 value; the table leaves the cell empty. */
const NONE = "";

type Column = { year0: string; year: (y: ProjectionYear) => string };

const money = (pick: (y: ProjectionYear) => number, year0: number | null, sign = 1): Column => ({
  year0: year0 === null ? NONE : formatMoney(sign * year0),
  year: (y) => formatMoney(sign * pick(y)),
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
    }),
    row("da", "D&A", money((y) => y.da, null, -1)),
    row("ebit", "EBIT", money((y) => y.ebit, null), { subtotal: true }),
    row("interest", "Interest", money((y) => y.interest, null, -1)),
    row("ebt", "EBT", money((y) => y.ebt, null)),
    row("tax", "Tax", money((y) => y.tax, null, -1)),
    row("netIncome", "Net income", money((y) => y.netIncome, null), { subtotal: true }),
    row("capex", "Capex", money((y) => y.capex, null, -1)),
    row("changeInNwc", "ΔNWC", money((y) => y.changeInNwc, null, -1)),
    row("fcf", "FCF", money((y) => y.fcf, null), { subtotal: true }),
    row("debt", "Debt (end of year)", money((y) => y.debt, entry.debt), { groupStart: true }),
    row("cash", "Cash", money((y) => y.cash, entry.cash)),
    row(
      "leverage",
      "Leverage",
      { year0: formatMultiple(entry.leverage), year: (y) => formatMultiple(y.leverage) },
      { groupStart: true },
    ),
    row("interestCoverage", "Interest coverage", {
      year0: NONE,
      year: (y) => (y.interestCoverage === null ? "—" : formatMultiple(y.interestCoverage)),
    }),
  ];
}
