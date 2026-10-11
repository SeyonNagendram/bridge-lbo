"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { LboInputs, SensitivityCell } from "@/lib/lbo";
import { formatMoM, formatMultiple, formatPercent } from "@/lib/format";
import {
  canShift,
  gridKeyAction,
  gridTones,
  isGridKey,
  metricValue,
  selectedPosition,
  windowGrid,
  type Axis,
  type Direction,
  type GridAnchor,
  type Metric,
  type Tone,
} from "@/lib/sensitivityView";
import { sectionTitle } from "./styles";
import { useFlash } from "./useFlash";

const METRICS: { value: Metric; label: string }[] = [
  { value: "irr", label: "IRR" },
  { value: "mom", label: "MoM" },
];

function formatValue(cell: SensitivityCell, metric: Metric): string {
  const value = metricValue(cell, metric);
  if (value === null) return "n.m.";
  return metric === "irr" ? formatPercent(value) : formatMoM(value);
}

/** Muted diverging fill against the grid's centre: .heat-up / .heat-down in globals.css, scaled by --tone. */
function toneClass(tone: Tone): string {
  return tone.direction === "flat" ? "bg-surface" : tone.direction === "up" ? "heat-up" : "heat-down";
}

interface CellProps {
  /** "row-col": the cell's position, stable while the values in it change. */
  pos: string;
  cell: SensitivityCell;
  metric: Metric;
  tone: Tone;
  /** The case currently in the inputs: outlined, never filled. */
  selected: boolean;
  focusable: boolean;
  onApply: () => void;
  onHot: () => void;
  onFocus: () => void;
}

function GridCell({ pos, cell, metric, tone, selected, focusable, onApply, onHot, onFocus }: CellProps) {
  const text = formatValue(cell, metric);
  // Keyed on both metrics, so switching IRR ↔ MoM doesn't flash every cell; only model changes do.
  const ref = useFlash<HTMLTableCellElement>(`${cell.irr}|${cell.mom}`);
  const entry = formatMultiple(cell.entryMultiple);
  const exit = formatMultiple(cell.exitMultiple);
  const metricLabel = metric === "irr" ? "IRR" : "MoM";
  const label = selected
    ? `Current case: entry ${entry}, exit ${exit} (${metricLabel} ${text})`
    : `Apply entry ${entry}, exit ${exit} (${metricLabel} ${text})`;

  return (
    // --tone as a 3-decimal string: the raw strength comes from IRR (Math.pow), which can differ in the
    // last digits between the server render (Node) and the browser, and React reports that as a
    // hydration mismatch. Three decimals is far finer than any visible difference in tint.
    <td ref={ref} className={`p-0 ${toneClass(tone)}`} style={{ "--tone": tone.strength.toFixed(3) } as CSSProperties}>
      <button
        type="button"
        data-pos={pos}
        tabIndex={focusable ? 0 : -1}
        aria-label={label}
        aria-current={selected ? "true" : undefined}
        onClick={onApply}
        onMouseEnter={onHot}
        onFocus={onFocus}
        // The focus ring sits inside the cell so the scroll container can't clip it.
        className={`block h-9 w-full px-1.5 text-right sm:px-3 focus-visible:-outline-offset-2 ${
          selected ? "outline-1 -outline-offset-1 outline-accent" : ""
        }`}
      >
        {text}
      </button>
    </td>
  );
}

/** Chevron for the window controls; points the way the window moves. */
function Chevron({ direction }: { direction: "up" | "down" | "left" | "right" }) {
  const rotate = { up: "rotate-180", down: "", left: "rotate-90", right: "-rotate-90" }[direction];
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={rotate}>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const shiftButton =
  "flex h-6 w-6 items-center justify-center rounded-[6px] border border-border text-muted transition-colors duration-150 hover:text-text disabled:opacity-40 disabled:hover:text-muted";

interface SensitivityGridProps {
  /** The current case (last valid inputs). */
  inputs: LboInputs;
  /** Centre of the visible window; moves only on panel changes, Reset, window shifts or Re-centre. */
  anchor: GridAnchor;
  onApply: (entryMultiple: number, exitMultiple: number) => void;
  onShift: (axis: Axis, direction: Direction) => void;
  onRecentre: () => void;
}

export function SensitivityGrid({ inputs, anchor, onApply, onShift, onRecentre }: SensitivityGridProps) {
  const [metric, setMetric] = useState<Metric>("irr");
  // Cell whose row and column headers are highlighted (pointer or keyboard).
  const [hot, setHot] = useState<[number, number] | null>(null);
  // Roving tabindex: one cell in the tab order; arrow keys move between cells.
  const [active, setActive] = useState<[number, number] | null>(null);
  // A cell to focus once the next render is on screen (after the window has shifted).
  const focusRequest = useRef<[number, number] | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const grid = windowGrid(inputs, anchor);
  const tones = gridTones(grid, metric);
  const available = grid.cells.map((row) => row.map((cell) => cell !== null));
  const mid = Math.floor(grid.cells.length / 2);
  const selected = selectedPosition(grid, inputs);

  // Tab stop: the last cell moved to, else the current case, else the centre (if any is blank, the next).
  const [ar, ac] =
    [active, selected, [mid, mid] as [number, number]].find((p) => p && available[p[0]]?.[p[1]]) ?? [mid, mid];

  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    const table = tableRef.current;
    // The requested cell, or the tab stop if that position is blank in the new window.
    (
      table?.querySelector<HTMLButtonElement>(`[data-pos="${request[0]}-${request[1]}"]`) ??
      table?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
    )?.focus();
  });

  function focusCell(row: number, col: number) {
    setActive([row, col]);
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-pos="${row}-${col}"]`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (!isGridKey(event.key)) return;
    event.preventDefault();
    const action = gridKeyAction(available, anchor, [ar, ac], event.key);
    if (action.kind === "move") focusCell(...action.to);
    if (action.kind === "shift") {
      // At the edge: the window moves by one step and focus stays at the same position,
      // which now shows the next multiple along.
      onShift(action.axis, action.direction);
      focusRequest.current = [ar, ac];
    }
  }

  function apply(cell: SensitivityCell, row: number, col: number) {
    // The grid stays where it is; only the outline moves to this cell.
    onApply(cell.entryMultiple, cell.exitMultiple);
    setActive([row, col]);
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

      {/* Window controls: each button moves the visible range by 0.5x and is disabled at the range limit. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px] text-muted">
        <div role="group" aria-label="Entry multiple range" className="flex items-center gap-1">
          <span className="mr-1">Entry</span>
          <button
            type="button"
            className={shiftButton}
            aria-label="Show lower entry multiples"
            disabled={!canShift(anchor, "entry", -1)}
            onClick={() => onShift("entry", -1)}
          >
            <Chevron direction="up" />
          </button>
          <button
            type="button"
            className={shiftButton}
            aria-label="Show higher entry multiples"
            disabled={!canShift(anchor, "entry", 1)}
            onClick={() => onShift("entry", 1)}
          >
            <Chevron direction="down" />
          </button>
        </div>
        {!selected && (
          <button
            type="button"
            onClick={onRecentre}
            className="word h-6 rounded-[6px] border border-border px-2 text-text transition-colors duration-150 hover:border-muted"
          >
            Re-centre
          </button>
        )}
        <div role="group" aria-label="Exit multiple range" className="flex items-center gap-1">
          <span className="mr-1">Exit</span>
          <button
            type="button"
            className={shiftButton}
            aria-label="Show lower exit multiples"
            disabled={!canShift(anchor, "exit", -1)}
            onClick={() => onShift("exit", -1)}
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            className={shiftButton}
            aria-label="Show higher exit multiples"
            disabled={!canShift(anchor, "exit", 1)}
            onClick={() => onShift("exit", 1)}
          >
            <Chevron direction="right" />
          </button>
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
            {metric === "irr" ? "IRR" : "MoM"} by entry multiple (rows) and exit multiple (columns). Shading compares
            each cell with the centre of the grid; the current case is marked. Use the arrow keys to move between
            cells (at the edge they move the range by 0.5x) and Enter to apply a cell&apos;s multiples.
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
              // Keyed by position, not value: shifting the window changes every value but keeps the DOM (and focus).
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
                      selected={selected?.[0] === row && selected?.[1] === col}
                      focusable={row === ar && col === ac}
                      onApply={() => apply(cell, row, col)}
                      onHot={() => setHot([row, col])}
                      // However focus arrives (click, Tab, script), that cell becomes the tab stop.
                      onFocus={() => {
                        setHot([row, col]);
                        setActive([row, col]);
                      }}
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
        Each cell <span className="word">re-runs</span> the full model with only the two multiples changed. Shading
        compares each cell with the centre of the grid: green higher, red lower. The outlined cell is the current
        case; select another to apply its multiples.
      </p>
    </section>
  );
}
