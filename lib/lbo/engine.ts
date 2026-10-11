import type {
  LboInputs,
  LboResult,
  LboWarning,
  ProjectionYear,
  ValidationError,
} from "./types";
import { validateInputs } from "./validate";

export const LOW_COVERAGE_THRESHOLD = 2.0;

function yearList(years: number[]): string {
  return years.length === 1 ? `Year ${years[0]}` : `Years ${years.join(", ")}`;
}

/**
 * Runs the full LBO model (brief §4). Pure function: no side effects, no rounding.
 * Assumes inputs have passed `validateInputs`; use `calculate` when that is not guaranteed.
 */
export function runLbo(inputs: LboInputs): LboResult {
  const {
    revenue0,
    ebitdaMargin,
    entryMultiple,
    leverage,
    feePct,
    revenueGrowth,
    interestRate,
    taxRate,
    capexPct,
    daPct,
    nwcPct,
    exitMultiple,
    holdingPeriod: N,
  } = inputs;

  // Entry (t = 0)
  const ebitda0 = revenue0 * ebitdaMargin;
  const evEntry = ebitda0 * entryMultiple;
  const debt0 = ebitda0 * leverage;
  const fees = evEntry * feePct;
  const equity0 = evEntry + fees - debt0;

  // Projection (t = 1 … N) with 100% cash sweep
  const years: ProjectionYear[] = [];
  const shortfallYears: number[] = [];
  const lowCoverageYears: number[] = [];

  let prevRevenue = revenue0;
  let prevDebt = debt0;
  let prevCash = 0;

  for (let t = 1; t <= N; t++) {
    const revenue = prevRevenue * (1 + revenueGrowth);
    const ebitda = revenue * ebitdaMargin;
    const da = revenue * daPct;
    const ebit = ebitda - da;
    const interest = prevDebt * interestRate; // on opening balance → no circularity
    const ebt = ebit - interest;
    const tax = Math.max(ebt, 0) * taxRate; // no negative tax
    const netIncome = ebt - tax;
    const capex = revenue * capexPct;
    const changeInNwc = (revenue - prevRevenue) * nwcPct;
    const fcf = netIncome + da - capex - changeInNwc;

    let debt: number;
    let cash: number;
    let repayment = 0;
    let newBorrowing = 0;
    if (fcf >= 0) {
      repayment = Math.min(fcf, prevDebt);
      debt = prevDebt - repayment;
      cash = prevCash + (fcf - repayment);
    } else {
      newBorrowing = -fcf;
      debt = prevDebt + newBorrowing;
      cash = prevCash;
      shortfallYears.push(t);
    }

    const interestCoverage = interest > 0 ? ebitda / interest : null;
    if (interestCoverage !== null && interestCoverage < LOW_COVERAGE_THRESHOLD) {
      lowCoverageYears.push(t);
    }

    years.push({
      year: t,
      revenue,
      ebitda,
      ebitdaMargin,
      da,
      ebit,
      interest,
      ebt,
      tax,
      netIncome,
      capex,
      changeInNwc,
      fcf,
      repayment,
      newBorrowing,
      debt,
      cash,
      leverage: debt / ebitda,
      interestCoverage,
    });

    prevRevenue = revenue;
    prevDebt = debt;
    prevCash = cash;
  }

  // Exit and returns
  const ebitdaN = prevRevenue * ebitdaMargin;
  const evExit = ebitdaN * exitMultiple;
  const equityExit = evExit - prevDebt + prevCash;

  const irrMeaningful = equityExit > 0;
  const mom = irrMeaningful ? equityExit / equity0 : 0;
  const irr = irrMeaningful ? Math.pow(mom, 1 / N) - 1 : null;

  // Value creation bridge — reconciles to equityExit − equity0 by construction
  const ebitdaGrowth = (ebitdaN - ebitda0) * entryMultiple;
  const multipleExpansion = (exitMultiple - entryMultiple) * ebitdaN;
  const debtPaydown = debt0 - prevDebt;
  const cashBuildUp = prevCash;
  const bridge = {
    ebitdaGrowth,
    multipleExpansion,
    debtPaydown,
    cashBuildUp,
    fees: -fees,
    total: ebitdaGrowth + multipleExpansion + debtPaydown + cashBuildUp - fees,
  };

  const warnings: LboWarning[] = [];
  if (shortfallYears.length > 0) {
    warnings.push({
      kind: "cashShortfall",
      years: shortfallYears,
      message: `Cash shortfall in ${yearList(shortfallYears)}: negative free cash flow is funded by additional borrowing.`,
    });
  }
  if (lowCoverageYears.length > 0) {
    warnings.push({
      kind: "lowInterestCoverage",
      years: lowCoverageYears,
      message: `Interest coverage below ${LOW_COVERAGE_THRESHOLD.toFixed(1)}x in ${yearList(lowCoverageYears)}.`,
    });
  }
  if (!irrMeaningful) {
    warnings.push({
      kind: "irrNotMeaningful",
      years: [N],
      message: `Equity value at exit (Year ${N}) is zero or negative, so IRR is not meaningful (n.m.).`,
    });
  }

  return {
    inputs: { ...inputs },
    entry: {
      revenue: revenue0,
      ebitda: ebitda0,
      enterpriseValue: evEntry,
      debt: debt0,
      fees,
      equity: equity0,
      cash: 0,
      leverage: debt0 / ebitda0,
    },
    years,
    exit: {
      ebitda: ebitdaN,
      enterpriseValue: evExit,
      debt: prevDebt,
      cash: prevCash,
      equity: equityExit,
    },
    returns: { mom, irr, irrMeaningful },
    bridge,
    warnings,
  };
}

export type CalculationOutcome =
  | { ok: true; result: LboResult }
  | { ok: false; errors: ValidationError[] };

/** Validates, then runs the model. The UI keeps the last `ok` result when this fails. */
export function calculate(inputs: LboInputs): CalculationOutcome {
  const errors = validateInputs(inputs);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, result: runLbo(inputs) };
}
