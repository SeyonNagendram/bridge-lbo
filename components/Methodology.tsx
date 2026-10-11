// Methodology (§8): static text, rendered on the server only, so it adds no JavaScript to the page.

import type { ReactNode } from "react";
import { sectionTitle } from "./styles";

/** One formula per line, monospaced, set off by a hairline rather than a box. */
function Formulas({ lines }: { lines: string[] }) {
  return (
    <div className="my-3 border-l border-border pl-3 font-mono text-[13px] leading-6 tabular-nums">
      {lines.map((line) => (
        // Hanging indent: a long formula that wraps on a phone stays readable as one line.
        <p key={line} className="pl-4 -indent-4">
          {line}
        </p>
      ))}
    </div>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <h4 className="font-medium">{title}</h4>
      {children}
    </li>
  );
}

const subheading = "mt-8 mb-2 font-serif text-[15px] font-semibold";

export function Methodology() {
  return (
    <section aria-labelledby="methodology-title" className="max-w-[72ch] text-pretty">
      <h2 id="methodology-title" className={`${sectionTitle} mb-3`}>
        Methodology
      </h2>

      <h3 className={subheading}>What an LBO is</h3>
      <p>
        A leveraged buyout (LBO) is the purchase of a company paid for mostly with borrowed money. The buyer, usually a
        private equity fund, puts in a smaller amount of its own money as equity. While the fund owns the company, the
        company&rsquo;s cash flow pays down the debt, so a growing share of the company&rsquo;s value belongs to the
        equity. When the company is sold, the remaining debt is repaid and everything left over goes to the fund.
      </p>

      <h3 className={subheading}>How the model works</h3>
      <p>
        All amounts are in € millions. Year 0 is the day of the purchase; the company is owned for N years, the holding
        period.
      </p>
      <ol className="mt-4 space-y-5">
        <Step title="1. Entry">
          <p>
            The price paid for the whole company, its enterprise value (EV), is EBITDA times the entry multiple. Debt is
            EBITDA times leverage, and fees are a percentage of EV. The equity pays for everything the debt
            doesn&rsquo;t cover, including the fees.
          </p>
          <Formulas
            lines={[
              "EBITDA(0) = Revenue(0) × EBITDA margin",
              "EV = EBITDA(0) × entry multiple",
              "Debt(0) = EBITDA(0) × leverage",
              "Equity invested = EV + Fees − Debt(0)",
            ]}
          />
        </Step>
        <Step title="2. Operations">
          <p>
            Revenue grows at a constant rate. EBITDA, D&amp;A and capex are fixed percentages of revenue. Net working
            capital (NWC: inventory and receivables minus payables) ties up a share of each year&rsquo;s increase in
            revenue. Interest is charged on the debt at the start of the year, so it doesn&rsquo;t depend on that
            year&rsquo;s repayment and the model has no circular reference. Tax is only paid on a profit; a loss
            doesn&rsquo;t create a tax refund.
          </p>
          <Formulas
            lines={[
              "Interest(t) = Debt(t−1) × interest rate",
              "Tax(t) = max(EBIT(t) − Interest(t), 0) × tax rate",
              "ΔNWC(t) = (Revenue(t) − Revenue(t−1)) × NWC %",
              "FCF(t) = Net income(t) + D&A(t) − Capex(t) − ΔNWC(t)",
            ]}
          />
        </Step>
        <Step title="3. Debt and cash">
          <p>
            All free cash flow (FCF) goes to repaying debt, a 100% cash sweep. Once the debt is fully repaid, the
            remaining cash builds up in the company. If FCF is negative, the gap is borrowed, so the debt goes up; the
            model shows a warning for that year.
          </p>
          <Formulas
            lines={[
              "Repayment(t) = min(FCF(t), Debt(t−1))",
              "Debt(t) = Debt(t−1) − Repayment(t)",
              "Cash(t) = Cash(t−1) + FCF(t) − Repayment(t)",
            ]}
          />
        </Step>
        <Step title="4. Exit and returns">
          <p>
            The company is sold at the end of Year N at the exit multiple. The equity is then worth the sale price
            minus the remaining debt plus any cash. MoM (multiple of money) is how many times the equity invested comes
            back. IRR is the annual return that turns the equity invested into the equity at exit over N years. If the
            equity at exit is zero or negative, the IRR is shown as n.m. (not meaningful).
          </p>
          <Formulas
            lines={[
              "Equity at exit = EBITDA(N) × exit multiple − Debt(N) + Cash(N)",
              "MoM = Equity at exit ÷ Equity invested",
              "IRR = MoM^(1/N) − 1",
            ]}
          />
        </Step>
        <Step title="5. Credit statistics">
          <p>
            Leverage shows how many years of EBITDA the debt amounts to; interest coverage shows how many times EBITDA
            covers the interest. The model shows a warning for any year with coverage below 2.0x.
          </p>
          <Formulas lines={["Leverage(t) = Debt(t) ÷ EBITDA(t)", "Interest coverage(t) = EBITDA(t) ÷ Interest(t)"]} />
        </Step>
        <Step title="6. Returns attribution">
          <p>
            The gain from equity invested to equity at exit is split into where it came from: higher EBITDA, a higher
            exit multiple, debt repaid, cash built up, minus the fees. The parts add up exactly to the total gain.
          </p>
          <Formulas
            lines={[
              "EBITDA growth = (EBITDA(N) − EBITDA(0)) × entry multiple",
              "Multiple expansion = (exit multiple − entry multiple) × EBITDA(N)",
              "Debt paydown = Debt(0) − Debt(N)",
              "Cash build-up = Cash(N)",
              "Equity at exit − Equity invested = EBITDA growth + Multiple expansion + Debt paydown + Cash build-up − Fees",
            ]}
          />
        </Step>
        <Step title="7. Sensitivity">
          <p>
            Each cell of the grid runs the whole model again with only the entry and exit multiples changed. The fees
            change with the purchase price.
          </p>
        </Step>
      </ol>

      <h3 className={subheading}>Simplifying assumptions</h3>
      <ul className="list-disc space-y-1 pl-5 marker:text-muted">
        <li>One type of debt, at one interest rate.</li>
        <li>Interest is charged on the debt at the start of each year.</li>
        <li>All free cash flow repays debt until the debt is gone (100% cash sweep).</li>
        <li>No minimum cash balance.</li>
        <li>No fixed repayment schedule: debt is only repaid out of free cash flow.</li>
        <li>The company is sold at the end of the final year.</li>
        <li>
          No dividends before the sale. The equity only has two cash flows, in at the start and out at the end, so IRR =
          MoM^(1/N) − 1.
        </li>
        <li>Transaction fees are paid entirely with equity.</li>
        <li>No management equity: the fund owns all of the equity.</li>
      </ul>

      <h3 className={subheading}>Colours</h3>
      <p>
        Figures you can change are shown in <span className="text-input">blue</span>; figures the model calculates
        are in black (white in dark mode). This follows the convention in banking Excel models, where blue marks an
        input typed in by hand and black a formula.
      </p>

      <p className="mt-8 text-muted">Illustrative model for educational purposes. Not investment advice.</p>
    </section>
  );
}
