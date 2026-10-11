# Project Brief — "Sweep" · LBO Returns Calculator

> Working title: **Sweep** (after the *cash sweep*: free cash flow used to repay debt). The name can change later; keep it in one constant so it is easy to replace.

## 0. How to work with me

- I'm Seyon, a first-year Business & Economics student at Goethe University Frankfurt, targeting investment banking and private equity. This app goes on my LinkedIn and CV. Recruiters and bankers will click it. It has to be **correct, fast and calm-looking**.
- I built the underlying model myself in Excel. **Every number in this app must match my Excel model exactly** (golden values in §6). If the code and the Excel disagree, the code is wrong until proven otherwise.
- Work in the **phases in §9**. **Stop at the end of every phase**, show me what you built, and explain each architectural decision in 2–3 plain sentences so I can defend it in an interview.
- **Do not add features, pages or dependencies beyond this brief without asking first.**
- Prefer fewer moving parts. No backend, no database, no auth, no analytics, no cookies.

## 1. What the app is

A public, no-login web app that models a simple leveraged buyout. The user changes deal assumptions and instantly sees:
- returns (IRR, MoM),
- the debt paydown year by year,
- where the returns came from,
- an IRR sensitivity grid (entry vs. exit multiple).

Target audience: bankers, PE professionals and recruiters spending 30–90 seconds on it. Within 5 seconds of opening it they should see a complete, sensible base case without touching anything.

## 2. Tech stack (fixed)

| Area | Choice | Reason |
|---|---|---|
| Framework | Next.js (latest stable, App Router), **static export** | I know it; static = fastest + free hosting |
| Language | TypeScript, `strict: true` | correctness |
| Styling | Tailwind CSS with design tokens as CSS variables | consistency, dark mode |
| Calculation | **Pure TypeScript module** `lib/lbo/` with no React imports | testable, reusable, framework-agnostic |
| Tests | Vitest | golden-value tests against my Excel |
| Charts | **Hand-built SVG components, no chart library** | performance and full design control |
| Font | Inter via `next/font`, `font-variant-numeric: tabular-nums` everywhere numbers appear; Source Serif 4 (weight 600 only) for the page title and section headings (§11) | aligned figures |
| Hosting | Vercel | |

All calculation runs in the browser. Recalculation must feel instant (< 1 ms for the full model incl. the 25-cell grid).

## 3. Inputs

Grouped exactly like this in the UI. Units shown next to each field. *(Updated after Phase 1: currency goes in the label instead, "Revenue, Year 0 (€m)", and the field shows only the number with one decimal, e.g. `50.0`.)*

**Transaction**
| Input | Default | Range |
|---|---|---|
| Revenue, Year 0 (€m) | 50 | 1 – 10,000 |
| EBITDA margin | 20% | 1 – 60% |
| Entry multiple (x EBITDA) | 8.0x | 3.0 – 20.0x |
| Leverage (x EBITDA) | 5.0x | 0.0 – 8.0x, and must be < entry multiple |
| Transaction fees (% of EV) | 2.0% | 0 – 5% |

**Operations**
| Input | Default | Range |
|---|---|---|
| Revenue growth p.a. | 6.0% | −10 – 30% |
| Interest rate on debt | 7.0% | 0 – 20% |
| Tax rate | 30% | 0 – 50% |
| Capex (% of revenue) | 3.0% | 0 – 20% |
| D&A (% of revenue) | 3.0% | 0 – 20% |
| NWC (% of revenue change) | 10% | 0 – 50% |

**Exit**
| Input | Default | Range |
|---|---|---|
| Exit multiple (x EBITDA) | 8.0x | 3.0 – 20.0x |
| Holding period (years) | 5 | 3 – 7 (integer) |

Input behaviour:
- Number fields with a small stepper and keyboard arrow support (↑/↓ = one step, Shift = 10 steps). Sensible steps: multiples 0.5x, percentages 0.5%, revenue 1.
- Invalid values: show an inline message, keep the last valid result on screen, never show NaN/Infinity anywhere.
- A "Reset to base case" action.
- **Inputs are shown in blue text, calculated values in near-black.** This mirrors the universal banking Excel convention (blue = input, black = formula) and is a deliberate signal to finance viewers. Mention it in the methodology section.

## 4. Calculation engine — exact specification

Notation: year `t = 0 … N` (N = holding period). All money in €m.

**Entry (t = 0)**
```
EBITDA_0        = Revenue_0 × margin
EV_entry        = EBITDA_0 × entryMultiple
Debt_0          = EBITDA_0 × leverage
Fees            = EV_entry × feePct
Equity_0        = EV_entry + Fees − Debt_0
```

**Projection (t = 1 … N)**
```
Revenue_t       = Revenue_{t−1} × (1 + growth)
EBITDA_t        = Revenue_t × margin
DA_t            = Revenue_t × daPct
EBIT_t          = EBITDA_t − DA_t
Interest_t      = Debt_{t−1} × interestRate          // on opening balance → no circularity
EBT_t           = EBIT_t − Interest_t
Tax_t           = max(EBT_t, 0) × taxRate             // no negative tax
NetIncome_t     = EBT_t − Tax_t
Capex_t         = Revenue_t × capexPct
dNWC_t          = (Revenue_t − Revenue_{t−1}) × nwcPct
FCF_t           = NetIncome_t + DA_t − Capex_t − dNWC_t
```

**Debt and cash (100% cash sweep)**
```
if FCF_t ≥ 0:
    repay       = min(FCF_t, Debt_{t−1})
    Debt_t      = Debt_{t−1} − repay
    Cash_t      = Cash_{t−1} + (FCF_t − repay)        // excess cash builds once debt is repaid
else:
    Debt_t      = Debt_{t−1} − FCF_t                  // shortfall funded by additional borrowing
    Cash_t      = Cash_{t−1}
    → raise a warning: "Cash shortfall in Year t"
Cash_0 = 0
```

**Exit and returns**
```
EV_exit         = EBITDA_N × exitMultiple
Equity_exit     = EV_exit − Debt_N + Cash_N
MoM             = Equity_exit / Equity_0
IRR             = MoM^(1/N) − 1                       // valid: only two equity cash flows
```
If `Equity_exit ≤ 0`: MoM = 0, IRR shown as "n.m." (not meaningful) with a short explanation.

**Credit statistics (per year)**
```
Leverage_t        = Debt_t / EBITDA_t
InterestCoverage_t = EBITDA_t / Interest_t           // "—" if Interest_t = 0
```
Warning if interest coverage < 2.0x in any year.

**Returns attribution (value creation bridge)** — must reconcile exactly to `Equity_exit − Equity_0`:
```
EBITDA growth       = (EBITDA_N − EBITDA_0) × entryMultiple
Multiple expansion  = (exitMultiple − entryMultiple) × EBITDA_N
Debt paydown        = Debt_0 − Debt_N
Cash build-up       = Cash_N
Fees                = −Fees
Sum                 = Equity_exit − Equity_0          // assert this in tests
```

**Sensitivity grid**
- 5 × 5 grid of IRR. Rows = entry multiple, columns = exit multiple.
- Centred on the current entry and exit multiple, steps of 0.5x (centre ± 1.0x). Skip/blank any cell where an input would leave the allowed range.
- Each cell = a full re-run of the engine with only those two inputs changed. Fees scale with entry EV.
- Toggle: IRR / MoM.

## 5. Screens and layout

One page plus a methodology section. No other routes in v1.

**Desktop (≥ 1024px):** two columns.
- **Left, sticky, ~340px:** input panel with the three groups.
- **Right, scrolling:**
  1. **Returns header:** 4 KPI tiles: IRR (largest), MoM, Equity invested, Equity at exit. One line beneath: entry leverage and Year-1 interest coverage.
  2. **Sources & Uses** — two small side-by-side tables (Uses: purchase price, fees, total · Sources: debt, equity, total; totals must match).
  3. **Debt paydown chart** — bars of Debt_t for t = 0…N, cash shown as a separate segment if > 0. Values labelled on bars. *(Updated after Phase 3: under each year label, that year's leverage (Debt / EBITDA) in small muted text, e.g. `5.0x`, an en dash once the debt is repaid; the same figures as the projection table's Leverage row. Debt bars in the muted grey of the capital structure bar, cash in `--positive`, with a Debt / Cash legend only once there is cash.)*
  4. **Returns attribution** — horizontal waterfall from equity invested to equity at exit using the bridge in §4. *(Updated after Phase 3: Equity invested → EBITDA growth → Multiple expansion → Debt paydown → Cash build-up (only if > 0) → Fees → Equity at exit. The two totals in the same grey as the debt bars, increases in `--positive`, decreases in `--negative`: grey = capital, green/red = value drivers, consistently across the page. Thin connector lines between bars, a value label on every bar. Every figure is rounded on its own, as in the projection table, with "Figures may not sum due to rounding." beneath; the totals read exactly as the KPI tiles, and the bars use exact values. Exact zeros show as an en dash, with the row kept and no bar. Next to each step's value, its share of the value created (Equity at exit − Equity invested) in small muted text, e.g. "27.1 · 55%", "(1.6) · −3%"; "n.m." when the value created is zero or negative at display precision, or for a share of ±1,000% or more. The shares sum to 100% within rounding; tested in `lib/__tests__/charts.test.ts`.)*
  5. **Sensitivity grid** — with the current case highlighted (outline, not a fill) and the colour scale described in §7.
  6. **Projection table** — rows: Revenue, EBITDA, EBITDA margin, D&A, EBIT, Interest, EBT, Tax, Net income, D&A (add-back), Capex, ΔNWC, FCF, Debt (end of year), Cash, Leverage, Interest coverage. Columns: Year 0 … N. Subtotal rows (EBITDA, EBIT, Net income, FCF) in medium weight with a hairline above. *(Updated after Phase 2: D&A is added back between Net income and Capex, so the cash flow block foots as displayed: Net income + D&A − Capex − ΔNWC = FCF. Deductions are shown in parentheses. Each figure is rounded on its own, so outside the base case the displayed parts can differ from the displayed FCF by up to 0.1–0.2 through rounding alone; tested in `lib/__tests__/projection.test.ts`.)*
- **Methodology** section at the bottom (see §8).
- **Footer:** "Built by Seyon Nagendram" with a LinkedIn link (placeholder URL constant), "Illustrative model, not investment advice.", link to the GitHub repo (placeholder constant).

**Mobile (< 1024px):** single column. KPI tiles first (2 × 2), then a collapsible "Assumptions" panel (open by default on first load), then the sections in the same order. Tables scroll horizontally inside their own container with the first column pinned; the page itself never scrolls horizontally.

**Shareable scenarios:** all inputs are encoded in the URL query string (short keys, only values that differ from the base case). Opening such a URL restores the scenario. A "Copy link" button copies the current URL. Updating the URL must not trigger navigation or re-render jank (use `history.replaceState`, debounced).

## 6. Golden values — the engine must reproduce my Excel model

Base case = defaults in §3, N = 5. Tolerance: ±0.05 for €m values, ±0.05x for multiples, ±0.1 percentage points for IRR.

| Item | Expected |
|---|---|
| EV entry | 80.0 |
| Fees | 1.6 |
| Equity invested | 31.6 |
| Revenue Y1 / Y5 | 53.0 / 66.9 |
| EBITDA Y5 | 13.38 |
| Interest Y1 | 3.50 |
| FCF Y1 … Y5 | 3.56 · 4.09 · 4.67 · 5.31 · 6.00 |
| Debt end of Y1 … Y5 | 46.44 · 42.35 · 37.68 · 32.37 · 26.37 |
| EV exit | 107.06 |
| Equity at exit | 80.69 |
| MoM | 2.55x |
| IRR | 20.6% |

**Sensitivity grid (IRR), base case** — rows = entry, columns = exit:

| Entry \ Exit | 7.0x | 7.5x | 8.0x | 8.5x | 9.0x |
|---|---|---|---|---|---|
| 7.0x | 25.8% | 28.2% | 30.4% | 32.5% | 34.5% |
| 7.5x | 20.5% | 22.8% | 24.9% | 26.9% | 28.8% |
| 8.0x | 16.3% | 18.6% | 20.6% | 22.6% | 24.4% |
| 8.5x | 12.9% | 15.1% | 17.1% | 18.9% | 20.7% |
| 9.0x | 10.0% | 12.1% | 14.1% | 15.9% | 17.6% |

Additional required tests:
- Bridge components sum exactly to `Equity_exit − Equity_0` (random inputs, 1,000 cases).
- High-cash-flow case where debt hits zero: cash builds up, debt never negative, equity at exit includes cash.
- Negative-FCF case: debt increases, warning raised.
- Equity at exit ≤ 0: IRR = "n.m.", no NaN/Infinity.
- Leverage ≥ entry multiple is rejected by validation.

## 7. Design system

**Character:** an institutional research note, not a consumer fintech app. Calm, precise, quiet confidence. Think of the restraint of a bank's annual report rather than a trading dashboard. Every element must earn its place.

**Rules**
- No gradients, no glassmorphism, no emoji, no stock icons as decoration, no drop shadows (hairline borders instead).
- One accent colour, used sparingly (active states, the IRR tile number, focus rings).
- Generous whitespace; 8px spacing grid.
- Corner radius 6px on tiles and inputs, 0 on tables.
- Numbers right-aligned, tabular figures, consistent decimals: €m to 1 decimal, multiples `8.0x`, percentages `20.6%`. Negative values in parentheses `(1.6)`, as in banking.
  - *(Updated after Phase 1)* MoM always has two decimals (`2.55x`); entry/exit multiples and leverage keep one (`8.0x`).
  - *(Updated after Phase 1)* The symbols `x` and `%` sit flush against the number, in inputs and outputs alike: `8.0x`, `20.0%`. Words take a space: `5 years`. Currency (€m) goes in labels and column headers, not next to the figure. *(Exception added in the Phase 1 polish: standalone KPI figures carry the unit, banking-style: `€31.6m`, `(€5.2m)`.)*
- Units in column headers or labels, never repeated in every cell.
- Motion: only 150ms opacity/colour transitions; respect `prefers-reduced-motion`. No animated number counters. *(Exception added after Phase 1: the ~600ms change highlight in §11.)*

**Tokens (CSS variables, light and dark)**
| Token | Light | Dark |
|---|---|---|
| `--bg` | #FAFAF8 | #0B0D10 |
| `--surface` | #FFFFFF | #12151A |
| `--border` | #E6E4DF | #23272E |
| `--text` | #0E1116 | #E8EAED |
| `--text-muted` | #6B6F76 | #8A9099 |
| `--accent` | #0F3D6E (deep navy) | #7FB2E5 |
| `--input` | #1D4ED8 (input blue) | #8AB4F8 |
| `--positive` | #1F6F4A | #5FBF8F |
| `--negative` | #A3302B | #E58C85 |

Dark mode follows the system setting, with a manual toggle in the header (choice remembered per browser).

**Typography (Inter; Source Serif 4 for the page title and section headings, see §11)**
- Page title 28/36, semibold
- Section titles 13px, uppercase, letter-spacing 0.06em, muted
- Body 14/22
- Table figures 13px, tabular
- IRR tile figure 40px, semibold, accent colour

**Sensitivity colour scale:** muted and diverging, centred on the current case: soft green for higher IRR, neutral at the centre, soft red for lower. Low saturation; text always meets contrast requirements. No traffic-light neon.

**Accessibility:** WCAG 2.1 AA. Every input has a visible label, full keyboard navigation, visible focus rings, charts have a text alternative (a visually hidden table or `aria-label` summary).

## 8. Methodology section (content I will review)

Short, plain-English explanation of:
1. What an LBO is (3–4 sentences).
2. Each step of the model, mirroring §4, with the formula shown in a monospace line.
3. **Simplifying assumptions, stated openly:** single debt tranche, interest on opening balance, 100% cash sweep, no minimum cash, no mandatory amortisation schedule, exit at end of final year, no dividends (so IRR = MoM^(1/N) − 1), fees fully equity-funded, no management equity.
4. The blue/black convention.
5. "Illustrative model for educational purposes. Not investment advice."

Draft this text, then **stop and let me review it** — I must be able to explain every sentence.

## 9. Phases (stop after each)

**Phase 0 — Engine and tests**
Project setup, `lib/lbo/` engine, types, input validation, all tests from §6 passing. No UI yet. Show me the test output.

**Phase 1 — Layout and inputs**
Page shell, design tokens, light/dark, input panel wired to the engine, KPI tiles, Sources & Uses. Desktop and mobile.

**Phase 2 — Tables and sensitivity**
Projection table, sensitivity grid with IRR/MoM toggle and colour scale.

**Phase 3 — Charts**
Debt paydown chart and returns attribution waterfall (hand-built SVG). *(Done; refinements from the Phase 3 review are recorded in §5, items 3 and 4.)*

**Phase 4 — Polish**
URL state and "Copy link", warnings (cash shortfall, low coverage, n.m. IRR), methodology draft, footer, empty/edge states, keyboard and screen-reader pass.
*(Noted after Phase 2)* Edge state to fix: very large deals overflow the KPI tiles. With revenue in the thousands a figure like "€120,000.0m" doesn't fit a phone-width tile.

**Phase 5 — Ship**
Metadata and Open Graph image (1200×630, title + IRR of the base case on a clean background) so the LinkedIn link preview looks good, favicon, README (what it is, screenshot, methodology summary, stack, how to run, how tests verify the model against Excel), Vercel deployment.

## 10. Quality bar (definition of done)

- All tests pass; `tsc --noEmit` and lint clean.
- `npm run check:browser` passes (after `npm run build`): the app in Chrome, production export and `next dev`, light and dark, desktop and 375px, with no console errors or warnings (including hydration mismatches, which only development builds report) and the main interactions working. Playwright is a dev dependency for this.
- Lighthouse ≥ 95 in Performance, Accessibility, Best Practices and SEO (mobile).
- No layout shift on load; first load JS as small as reasonably possible (report the size).
- No console errors or warnings.
- Works in current Chrome, Safari, Firefox; on a 375px-wide phone.
- No NaN, Infinity or `undefined` reachable through any input combination.
- No secrets in the repo (none should exist; confirm before the repo goes public).

## 11. Refinements after Phase 1

Added in the fix-and-refine pass between Phase 1 and Phase 2. They are part of the spec from here on, under the same §7 restraint: no gradients, no shadows, nothing decorative.

6. **Live deal summary.** Under the title, one sentence that updates with the inputs, written like the first line of an investment memo, e.g. "Acquire at 8.0x EBITDA (€80.0m), funded 61% debt / 39% equity; exit after 5 years at 8.0x → 20.6% IRR, 2.55x MoM." Key figures in medium weight. At most ~70ch wide with `text-wrap: pretty`, so it breaks at natural points without orphaned fragments. While inputs are invalid it describes the last valid result. With zero leverage it reads "funded entirely with equity"; with a non-meaningful IRR it shows "n.m. IRR". Debt/equity percentages are whole numbers that always sum to 100. (Text built by `dealSummary` in `lib/deal.ts`, unit-tested.)
7. **KPI hierarchy.** The IRR tile is the headline: twice the width of each other tile on desktop (`2fr 1fr 1fr 1fr`); mobile stays 2 × 2. Tiles are compact (12px side padding); figures share a baseline across tiles. Labels are short ("Equity invested", "Equity at exit") and never wrap at any width: on desktop the three small tiles never shrink below their content, so the IRR tile gives up width first.
8. **Delta vs base case.** Under each KPI, a small line such as "+2.1pp vs base" (IRR), "+0.12x vs base" (MoM) or "+€5.1m vs base" (€m tiles), with an explicit +/− sign rather than parentheses. Coloured by meaning, not sign: for IRR, MoM and Equity at exit, `--positive` up and `--negative` down; the Equity invested delta is always muted, because a bigger cheque is not good news. Any delta that rounds to zero is muted. When the inputs equal the base case the line reads a muted "Base case"; when no delta applies it stays empty but keeps its height, so the tiles never jump. Not shown when either IRR is n.m.
9. **Capital structure bar** in Sources & Uses: one thin (8px) horizontal bar split into debt and equity, square ends, hairline outline, labelled "Debt 61%" / "Equity 39%". Not animated. Has a text alternative (`role="img"` + `aria-label`).
10. **Typography.** Source Serif 4 via `next/font`, weight 600 only, for the page title and section headings (including the assumption group titles). Inputs, tables and all numbers stay in Inter with tabular figures.
11. **Change highlighting.** When an output value changes, its cell or tile gets a faint accent tint (`--accent` at 12% over `--surface`) that fades out over about 600ms. Not on first load. Disabled under `prefers-reduced-motion`. No number counting animations.
12. **Assumptions panel header.** On mobile the whole header row is the collapse toggle, with a chevron on the right and `aria-expanded`. "Reset to base case" sits at the bottom of the panel on mobile and desktop (on desktop outside the scrolling field list, so it is always reachable).
13. **Sensitivity grid interaction.** *(Revised: stable grid.)* The grid shows a 5 × 5 window around an anchor (anchor ± 1.0x on both axes). Clicking a cell, or Enter on a focused cell, sets the entry and exit multiple to that cell's values, but the grid does **not** re-centre: axes and cell positions stay where they are, and only the outline moves to the selected cell. Shading is measured against the anchor (the grid's centre cell), not the selected cell, so colours stay put when the selection changes. The grid re-centres only when the entry or exit multiple is changed from the assumptions panel, or on Reset; changes that come from the grid itself never re-centre it. Small ˄ ˅ buttons on the entry axis and ‹ › on the exit axis shift the window by 0.5x, each disabled once the row or column it would bring in lies outside the input range (3.0–20.0x). If the selected case is outside the visible window, a small "Re-centre" button appears. Hovering or focusing a cell lightly highlights its row and column headers. Each cell is a button with an `aria-label` such as "Apply entry 7.5x, exit 8.5x (IRR 26.9%)"; the selected one reads "Current case: …" and has `aria-current`. Keyboard: the grid is one tab stop; arrow keys move between cells (skipping blank ones), and at the edge of the grid the next arrow press shifts the window by 0.5x; Home / End jump to the ends of the row. State rules live in `lib/calculatorState.ts` and are unit-tested.
   **Shading strength:** heat colours `--heat-up` / `--heat-down`, slightly more saturated than `--positive` / `--negative`, mixed into the surface at up to 48% (light) and 40% (dark): a tint reads much weaker on white than on a near-black surface, and at these values both themes measure about equally strong (OKLab distance from the surface ≈ 23–26 at full tint). One symmetric scale for green and red, normalised to the largest absolute deviation from the centre, so a smaller downside never looks as large as the upside; strength = √(|deviation| / largest deviation), which lifts mid-range cells while keeping the order of magnitudes. Cells with almost the same value as the centre (difference below display precision) stay neutral. Cell text stays at WCAG AA in every cell in both themes, checked by `lib/__tests__/heat.test.ts`.
