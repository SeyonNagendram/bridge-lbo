"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { sensitivityGrid, type LboInputs, type SensitivityCell } from "@/lib/lbo";
import { formatMoM, formatMultiple, formatPercent } from "@/lib/format";
import { gridTones, isGridKey, metricValue, moveInGrid, type Metric, type Tone } from "@/lib/sensitivityView";
import { sectionTitle } from "./styles";
import { useFlash } from "./useFlash";

const METRICS: { value: Metric; label: string }[] = [
  { value: "irr", label: "IRR" },
  { value: "mom", label: "MoM" },
];

/** Strongest tint, as a share of the semantic colour over the surface. Low, so the scale stays muted. */
const MAX_TINT = 18;

function formatValue(cell: SensitivityCell, metric: Metric): string {
  const value = metricValue(cell, metric);
  if (value === null) return "n.m.";
  return metric === "irr" ? formatPercent(value) : formatMoM(value);
}

/** Muted diverging fill: green above the current case, red below, the plain surface at the centre. */
function toneBackground(tone: Tone): string | undefined {
  if (tone.direction === "flat") return undefined;
  const colour = tone.direction === "up" ? "var(--positive)" : "var(--negative)";
  const share = Math.round(tone.strength * MAX_TINT);
  return `color-mix(in srgb, ${colour} ${share}%, var(--surface))`;
}

interface CellProps {
  /** "row-col": the cell's position, stable while the values in it change. */
  pos: string;
  cell: SensitivityCell;
  metric: Metric;
  tone: Tone;
  current: boolean;
  focusable: boolean;
  onApply: (byKeyboard: boolean) => void;
  onHot: () => void;
}

function GridCell({ pos, cell, metric, tone, current, focusable, onApply, onHot }: CellProps) {
  const text = formatValue(cell, metric);
  // Keyed on both metrics, so switching IRR ↔ MoM doesn't flash every cell; only model changes do.
  const ref = useFlash<HTMLTableCellElement>(`${cell.irr}|${cell.mom}`);
  const entry = formatMultiple(cell.entryMultiple);
  const exit = formatMultiple(cell.exitMultiple);
  const metricLabel = metric === "irr" ? "IRR" : "MoM";
  const label = current
    ? `Current case: entry ${entry}, exit ${exit} (${metricLabel} ${text})`
    : `Apply entry ${entry}, exit ${exit} (${metricLabel} ${text})`;

  return (
    <td
      ref={ref}
      className="p-0"
      style={{ backgroundColor: toneBackground(tone) ?? "var(--surface)" }}
    >
      <button
        type="button"
        data-pos={pos}
        tabIndex={focusable ? 0 : -1}
        aria-label={label}
        aria-current={current ? "true" : undefined}
        // detail is 0 when the click comes from Enter / Space rather than a pointer.
        onClick={(event) => onApply(event.detail === 0)}
        onMouseEnter={onHot}
        onFocus={onHot}
        // The current case is outlined, never filled; the focus ring sits inside the cell so the
        // scroll container can't clip it.
        className={`block h-9 w-full px-1.5 text-right sm:px-3 focus-visible:-outline-offset-2 ${
          current ? "outline-1 -outline-offset-1 outline-accent" : ""
        }`}
      >
        {text}
      </button>
    </td>
  );
}

interface SensitivityGridProps {
  inputs: LboInputs;
  onApply: (entryMultiple: number, exitMultiple: number) => void;
}

export function SensitivityGrid({ inputs, onApply }: SensitivityGridProps) {
  const [metric, setMetric] = useState<Metric>("irr");
  // Cell whose row and column headers are highlighted (pointer or keyboard).
  const [hot, setHot] = useState<[number, number] | null>(null);
  // Roving tabindex: one cell in the tab order; arrow keys move between cells.
  const [active, setActive] = useState<[number, number]>([2, 2]);
  const tableRef = useRef<HTMLTableElement>(null);

  const grid = sensitivityGrid(inputs);
  const tones = gridTones(grid, metric);
  const available = grid.cells.map((row) => row.map((cell) => cell !== null));
  const mid = Math.floor(grid.cells.length / 2);

  // If the active cell has become blank (inputs changed), fall back to the current case.
  const [ar, ac] = available[active[0]]?.[active[1]] ? active : [mid, mid];

  function focusCell(row: number, col: number) {
    setActive([row, col]);
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-pos="${row}-${col}"]`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (!isGridKey(event.key)) return;
    event.preventDefault();
    const [row, col] = moveInGrid(available, [ar, ac], event.key);
    focusCell(row, col);
  }

  function apply(cell: SensitivityCell, byKeyboard: boolean) {
    onApply(cell.entryMultiple, cell.exitMultiple);
    // The grid recentres on the applied case, so it is now the middle cell. Keyboard users follow it
    // there; a pointer user's highlight stays under the pointer. Cells are keyed by position, so the
    // middle button survives the re-render.
    if (byKeyboard) focusCell(mid, mid);
    else setActive([mid, mid]);
  }

  const headerTone = (isHot: boolean) =>
    `transition-colors duration-150 ${isHot ? "bg-accent/8 text-text" : "text-muted"}`;

  return (
    <section aria-labelledby="sensitivity-title">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="sensitivity-title" className={sectionTitle}>
          Sensitivity
        </h2>
        <div role="group" aria-label="Metric" className="flex rounded-[6px] border border-border text-[13px]">
          {METRICS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={metric === value}
              onClick={() => setMetric(value)}
              className={`h-7 px-3 transition-colors duration-150 first:rounded-l-[5px] last:rounded-r-[5px] ${
                metric === value ? "bg-accent/8 font-medium text-accent" : "text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Fits a 375px phone; scrolls inside its container rather than squeezing figures any further. */}
      <div className="overflow-x-auto">
        <table
          ref={tableRef}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setHot(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setHot(null);
          }}
          className="w-full min-w-[320px] table-fixed border-collapse text-[13px]"
        >
          <caption className="sr-only">
            {metric === "irr" ? "IRR" : "MoM"} by entry multiple (rows) and exit multiple (columns), centred on the
            current case. Use the arrow keys to move between cells and Enter to apply a cell&apos;s multiples.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-[21%] py-2 pr-2 text-left text-[12px] font-normal whitespace-nowrap text-muted sm:text-[13px]">
                <span aria-hidden="true">Entry \ Exit</span>
                <span className="sr-only">Entry multiple by exit multiple</span>
              </th>
              {grid.exitMultiples.map((exit, col) => (
                <th
                  key={col}
                  scope="col"
                  className={`px-1.5 py-2 text-right font-medium sm:px-3 ${headerTone(hot?.[1] === col)}`}
                >
                  <span className="sr-only">Exit </span>
                  {formatMultiple(exit)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.entryMultiples.map((entry, row) => (
              // Keyed by position, not value: recentring changes every value but keeps the DOM (and focus).
              <tr key={row} className="border-b border-border">
                <th scope="row" className={`py-2 pr-3 pl-1 text-left font-medium ${headerTone(hot?.[0] === row)}`}>
                  <span className="sr-only">Entry </span>
                  {formatMultiple(entry)}
                </th>
                {grid.cells[row].map((cell, col) =>
                  cell ? (
                    <GridCell
                      key={col}
                      pos={`${row}-${col}`}
                      cell={cell}
                      metric={metric}
                      tone={tones[row][col]!}
                      current={row === mid && col === mid}
                      focusable={row === ar && col === ac}
                      onApply={(byKeyboard) => apply(cell, byKeyboard)}
                      onHot={() => setHot([row, col])}
                    />
                  ) : (
                    // Outside the allowed input range: left blank (§4).
                    <td key={col} className="bg-surface">
                      <span className="sr-only">Not available</span>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-muted">
        Each cell <span className="word">re-runs</span> the full model with only the two multiples changed. Shading shows the change against the
        current case (outlined): green higher, red lower. Select a cell to apply its multiples.
      </p>
    </section>
  );
}
