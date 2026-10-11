import { Fragment } from "react";
import { BASE_CASE, runLbo, type LboResult } from "@/lib/lbo";
import { isBaseCase } from "@/lib/deal";
import { formatDelta, formatEuro, formatEuroDelta, formatMoM, formatMultiple, formatPercent, type Delta } from "@/lib/format";
import { warningLines } from "@/lib/warnings";
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
}

/** Figure size: one step smaller for an unusually long figure (an extreme case), so it never overflows a phone-width tile. */
function figureClass(figure: string, headline: boolean): string {
  if (headline) {
    // 32px below 640px so a figure like (12.3%) fits a half-width phone tile; 40px per §7 above.
    const phone = figure.length > 7 ? "text-[24px]" : "text-[32px]";
    return `block ${phone} leading-10 font-semibold whitespace-nowrap text-accent sm:text-[40px] sm:leading-[44px]`;
  }
  return `block ${figure.length > 9 ? "text-[20px]" : "text-[24px]"} leading-8 font-semibold whitespace-nowrap`;
}

/** The delta as read aloud: "pp" and "vs" spelled out. */
function spokenDelta(delta: Delta): string {
  return `${delta.text.replace(/pp$/, " percentage points")} versus base case`;
}

function Tile({ label, figure, delta, baseCase, neutral = false, headline = false }: TileProps) {
  const ref = useFlash<HTMLDivElement>(figure);
  const deltaText = baseCase ? "Base case" : delta ? `${delta.text} vs base` : null;
  return (
    <div ref={ref} className="flex flex-col rounded-[6px] border border-border bg-surface px-3 pt-2 pb-2.5">
      {/* Labels never wrap; the desktop grid sizes the small tiles to fit them (see KpiTiles). */}
      <dt className="text-[13px] leading-5 whitespace-nowrap text-muted">{label}</dt>
      {/* mt-auto: figures share a baseline across tiles. */}
      <dd className="mt-auto pt-1">
        <span className={figureClass(figure, headline)}>{figure}</span>
        {/* The line is always present, so tiles don't change height when deltas appear. */}
        <span
          className={`block text-[12px] leading-4 ${
            delta && !neutral ? DELTA_COLOUR[delta.direction] : "text-muted"
          }`}
        >
          {deltaText === null ? (
            "\u00a0"
          ) : (
            <>
              <span aria-hidden="true">{deltaText}</span>
              <span className="sr-only">{!baseCase && delta ? spokenDelta(delta) : deltaText}</span>
            </>
          )}
        </span>
      </dd>
    </div>
  );
}

/** Small warning sign in --negative beside the warnings line; the text carries the meaning. */
function WarningIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="mt-[3px] shrink-0 text-negative"
    >
      <path d="M8 2.5 14 13H2L8 2.5Z" strokeLinejoin="round" />
      <path d="M8 6.5v3" strokeLinecap="round" />
      <circle cx="8" cy="11.25" r="0.4" fill="currentColor" />
    </svg>
  );
}

/**
 * Cash shortfall, low interest coverage and n.m. IRR, each naming its years, as one calm line under
 * the tiles. The live region is always mounted so a screen reader announces a warning when it appears.
 */
function Warnings({ lines }: { lines: string[] }) {
  return (
    <div role="status">
      {lines.length > 0 && (
        <p className="mt-2 flex gap-2 text-[13px] leading-5 text-muted">
          <WarningIcon />
          <span>
            <span className="sr-only">{lines.length === 1 ? "Warning: " : "Warnings: "}</span>
            {lines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                {i > 0 && <span className="sr-only">; </span>}
                {line}
              </Fragment>
            ))}
          </span>
        </p>
      )}
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
          figure={formatEuro(entry.equity)}
          neutral
          delta={showDeltas ? formatEuroDelta(entry.equity - BASE.entry.equity) : null}
          baseCase={baseCase}
        />
        <Tile
          label="Equity at exit"
          figure={formatEuro(exit.equity)}
          delta={showDeltas ? formatEuroDelta(exit.equity - BASE.exit.equity) : null}
          baseCase={baseCase}
        />
      </dl>
      <p className="mt-3 text-muted">
        Entry leverage <LineFigure value={formatMultiple(entry.leverage)} />
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        <span className="word">Year-1</span> interest coverage{" "}
        <LineFigure value={coverageYear1 === null ? "—" : formatMultiple(coverageYear1)} />
        {coverageYear1 === null && <span className="sr-only">(no interest)</span>}
      </p>
      <Warnings lines={warningLines(result)} />
    </section>
  );
}
