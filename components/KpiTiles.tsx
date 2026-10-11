import { BASE_CASE, runLbo, type LboResult } from "@/lib/lbo";
import { isBaseCase } from "@/lib/deal";
import { formatDelta, formatEuroMillions, formatMoM, formatMultiple, formatPercent, type Delta } from "@/lib/format";
import { sectionTitle } from "./styles";
import { useFlash } from "./useFlash";

// The reference point for "vs base" deltas; computed once per page load.
const BASE = runLbo(BASE_CASE);

const DELTA_COLOUR: Record<Delta["direction"], string> = {
  up: "text-positive",
  down: "text-negative",
  flat: "text-muted",
};

interface TileProps {
  label: string;
  figure: string;
  /** null = no delta to show (base case, or not meaningful). */
  delta: Delta | null;
  /** Inputs equal the base case: the delta line reads "Base case" instead. */
  baseCase: boolean;
  /** Deltas are coloured by meaning (up = good news). Neutral keeps them grey: a bigger cheque is not good news. */
  neutral?: boolean;
  headline?: boolean;
  note?: string;
}

function Tile({ label, figure, delta, baseCase, neutral = false, headline = false, note }: TileProps) {
  const ref = useFlash<HTMLDivElement>(figure);
  return (
    <div ref={ref} className="flex flex-col rounded-[6px] border border-border bg-surface px-3 pt-2 pb-2.5">
      {/* Labels never wrap; the desktop grid sizes the small tiles to fit them (see KpiTiles). */}
      <dt className="text-[13px] leading-5 whitespace-nowrap text-muted">{label}</dt>
      {/* mt-auto: figures share a baseline across tiles even if a note makes one taller. */}
      <dd className="mt-auto pt-1">
        <span
          className={
            headline
              ? // 32px below 640px so a figure like (12.3%) fits a half-width phone tile; 40px per §7 above.
                "block text-[32px] leading-10 font-semibold text-accent sm:text-[40px] sm:leading-[44px]"
              : "block text-[24px] leading-8 font-semibold"
          }
        >
          {figure}
        </span>
        {note && <span className="block text-[12px] leading-4 text-muted">{note}</span>}
        {/* The line is always present, so tiles don't change height when deltas appear. */}
        <span
          className={`block text-[12px] leading-4 ${
            delta && !neutral ? DELTA_COLOUR[delta.direction] : "text-muted"
          }`}
        >
          {baseCase ? "Base case" : delta ? `${delta.text} vs base` : "\u00a0"}
        </span>
      </dd>
    </div>
  );
}

function LineFigure({ value }: { value: string }) {
  const ref = useFlash<HTMLSpanElement>(value);
  return (
    <span ref={ref} className="text-text">
      {value}
    </span>
  );
}

export function KpiTiles({ result }: { result: LboResult }) {
  const { entry, years, exit, returns } = result;
  const coverageYear1 = years[0]?.interestCoverage ?? null;
  const baseCase = isBaseCase(result.inputs);
  const showDeltas = !baseCase;

  const irrDelta =
    showDeltas && returns.irr !== null && BASE.returns.irr !== null
      ? formatDelta((returns.irr - BASE.returns.irr) * 100, 1, "pp")
      : null;

  return (
    <section aria-labelledby="returns-title">
      <h2 id="returns-title" className={`${sectionTitle} mb-3`}>
        Returns
      </h2>
      {/* Desktop: IRR is the headline at twice the width of the other tiles; the small tiles never
          shrink below their content, so on a narrow desktop the IRR tile gives up width first.
          Mobile: 2 × 2. */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(max-content,1fr))]">
        <Tile
          label="IRR"
          headline
          figure={returns.irr === null ? "n.m." : formatPercent(returns.irr)}
          note={returns.irrMeaningful ? undefined : "Equity at exit is zero or negative."}
          delta={irrDelta}
          baseCase={baseCase}
        />
        <Tile
          label="MoM"
          figure={formatMoM(returns.mom)}
          delta={showDeltas ? formatDelta(returns.mom - BASE.returns.mom, 2, "x") : null}
          baseCase={baseCase}
        />
        <Tile
          label="Equity invested"
          figure={formatEuroMillions(entry.equity)}
          neutral
          delta={showDeltas ? formatDelta(entry.equity - BASE.entry.equity, 1, "m", "€") : null}
          baseCase={baseCase}
        />
        <Tile
          label="Equity at exit"
          figure={formatEuroMillions(exit.equity)}
          delta={showDeltas ? formatDelta(exit.equity - BASE.exit.equity, 1, "m", "€") : null}
          baseCase={baseCase}
        />
      </dl>
      <p className="mt-3 text-muted">
        Entry leverage <LineFigure value={formatMultiple(entry.leverage)} />
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        <span className="word">Year-1</span> interest coverage{" "}
        <LineFigure value={coverageYear1 === null ? "—" : formatMultiple(coverageYear1)} />
      </p>
    </section>
  );
}
