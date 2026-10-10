import type { LboResult } from "@/lib/lbo";
import { formatMoney, formatMultiple, formatPercent } from "@/lib/format";
import { sectionTitle } from "./styles";

const tile = "rounded-[6px] border border-border bg-surface p-4";
const tileLabel = "text-[13px] text-muted";
const tileFigure = "mt-2 text-[24px] leading-8 font-semibold";

export function KpiTiles({ result }: { result: LboResult }) {
  const { entry, years, exit, returns } = result;
  const coverageYear1 = years[0]?.interestCoverage ?? null;

  return (
    <section aria-labelledby="returns-title">
      <h2 id="returns-title" className={`${sectionTitle} mb-3`}>
        Returns
      </h2>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={tile}>
          <dt className={tileLabel}>IRR</dt>
          {/* 32px below 640px so a figure like (12.3%) fits a half-width phone tile; 40px per §7 above. */}
          <dd className="mt-2 text-[32px] leading-10 font-semibold text-accent sm:text-[40px] sm:leading-[48px]">
            {returns.irr === null ? "n.m." : formatPercent(returns.irr)}
          </dd>
          {!returns.irrMeaningful && (
            <dd className="mt-1 text-[12px] leading-4 text-muted">Equity at exit is zero or negative.</dd>
          )}
        </div>
        <div className={tile}>
          <dt className={tileLabel}>MoM</dt>
          <dd className={tileFigure}>{formatMultiple(returns.mom)}</dd>
        </div>
        <div className={tile}>
          <dt className={tileLabel}>Equity invested (€m)</dt>
          <dd className={tileFigure}>{formatMoney(entry.equity)}</dd>
        </div>
        <div className={tile}>
          <dt className={tileLabel}>Equity at exit (€m)</dt>
          <dd className={tileFigure}>{formatMoney(exit.equity)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-muted">
        Entry leverage <span className="text-text">{formatMultiple(entry.leverage)}</span>
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        Year-1 interest coverage{" "}
        <span className="text-text">{coverageYear1 === null ? "—" : formatMultiple(coverageYear1)}</span>
      </p>
    </section>
  );
}
