// All money values are in €m. All percentages are decimals (0.2 = 20%). Multiples are plain numbers (8 = 8.0x).

export interface LboInputs {
  // Transaction
  revenue0: number;
  ebitdaMargin: number;
  entryMultiple: number;
  leverage: number;
  feePct: number;
  // Operations
  revenueGrowth: number;
  interestRate: number;
  taxRate: number;
  capexPct: number;
  daPct: number;
  nwcPct: number;
  // Exit
  exitMultiple: number;
  holdingPeriod: number;
}

export type InputKey = keyof LboInputs;

/** Entry balance sheet at t = 0. */
export interface EntryValues {
  revenue: number;
  ebitda: number;
  enterpriseValue: number;
  debt: number;
  fees: number;
  equity: number;
  cash: number;
  /** Debt_0 / EBITDA_0 */
  leverage: number;
}

/** One projected year, t = 1 … N. */
export interface ProjectionYear {
  year: number;
  revenue: number;
  ebitda: number;
  ebitdaMargin: number;
  da: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  capex: number;
  changeInNwc: number;
  fcf: number;
  /** Debt repaid from FCF this year (0 in a shortfall year). */
  repayment: number;
  /** Additional borrowing to fund negative FCF (0 otherwise). */
  newBorrowing: number;
  debt: number;
  cash: number;
  /** Debt_t / EBITDA_t */
  leverage: number;
  /** EBITDA_t / Interest_t, or null when interest is zero (shown as "—"). */
  interestCoverage: number | null;
}

export interface ExitValues {
  ebitda: number;
  enterpriseValue: number;
  debt: number;
  cash: number;
  equity: number;
}

export interface Returns {
  /** Equity_exit / Equity_0, or 0 when equity at exit is ≤ 0. */
  mom: number;
  /** MoM^(1/N) − 1, or null when not meaningful ("n.m."). */
  irr: number | null;
  irrMeaningful: boolean;
}

/** Value creation bridge. Components sum to Equity_exit − Equity_0. */
export interface ReturnsBridge {
  ebitdaGrowth: number;
  multipleExpansion: number;
  debtPaydown: number;
  cashBuildUp: number;
  fees: number;
  total: number;
}

export type LboWarning =
  | { kind: "cashShortfall"; years: number[]; message: string }
  | { kind: "lowInterestCoverage"; years: number[]; message: string }
  | { kind: "irrNotMeaningful"; years: number[]; message: string };

export interface LboResult {
  inputs: LboInputs;
  entry: EntryValues;
  years: ProjectionYear[];
  exit: ExitValues;
  returns: Returns;
  bridge: ReturnsBridge;
  warnings: LboWarning[];
}

export interface ValidationError {
  field: InputKey;
  message: string;
}
