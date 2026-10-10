import type { EntryValues } from "@/lib/lbo";
import { fundingSplit } from "@/lib/deal";
import { formatMoney } from "@/lib/format";
import { sectionTitle } from "./styles";
import { useFlash } from "./useFlash";

interface Row {
  label: string;
  value: number;
}

function MoneyCell({ value }: { value: number }) {
  const text = formatMoney(value);
  const ref = useFlash<HTMLTableCellElement>(text);
  return (
    <td ref={ref} className="py-2 text-right">
      {text}
    </td>
  );
}

function MoneyTable({ title, rows, total }: { title: string; rows: Row[]; total: Row }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="py-2 text-left font-medium">
            {title}
          </th>
          <th scope="col" className="py-2 text-right font-normal text-muted">
            €m
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-border">
            <th scope="row" className="py-2 text-left font-normal">
              {row.label}
            </th>
            <MoneyCell value={row.value} />
          </tr>
        ))}
        <tr className="border-b border-border font-medium">
          <th scope="row" className="py-2 text-left font-medium">
            {total.label}
          </th>
          <MoneyCell value={total.value} />
        </tr>
      </tbody>
    </table>
  );
}

/** One thin bar split into debt and equity: square ends, hairline outline, no animation. */
function CapitalStructureBar({ entry }: { entry: EntryValues }) {
  const split = fundingSplit(entry);
  return (
    <div className="mt-6">
      <div aria-hidden="true" className="flex justify-between text-[13px]">
        <span>
          Debt <span className="font-medium">{split.debtPct}%</span>
        </span>
        <span>
          Equity <span className="font-medium">{split.equityPct}%</span>
        </span>
      </div>
      <div
        role="img"
        aria-label={`Capital structure: ${split.debtPct}% debt, ${split.equityPct}% equity`}
        className="mt-1 flex h-2 border border-border"
      >
        <div className="bg-muted" style={{ width: `${split.debtShare * 100}%` }} />
        <div className="flex-1 bg-border" />
      </div>
    </div>
  );
}

export function SourcesUses({ entry }: { entry: EntryValues }) {
  return (
    <section aria-labelledby="sources-uses-title">
      <h2 id="sources-uses-title" className={`${sectionTitle} mb-3`}>
        Sources &amp; Uses
      </h2>
      <div className="grid gap-8 sm:grid-cols-2">
        <MoneyTable
          title="Uses"
          rows={[
            { label: "Purchase price (EV)", value: entry.enterpriseValue },
            { label: "Transaction fees", value: entry.fees },
          ]}
          total={{ label: "Total uses", value: entry.enterpriseValue + entry.fees }}
        />
        <MoneyTable
          title="Sources"
          rows={[
            { label: "Debt", value: entry.debt },
            { label: "Equity", value: entry.equity },
          ]}
          total={{ label: "Total sources", value: entry.debt + entry.equity }}
        />
      </div>
      <CapitalStructureBar entry={entry} />
    </section>
  );
}
