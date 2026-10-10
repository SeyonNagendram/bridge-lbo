import type { EntryValues } from "@/lib/lbo";
import { formatMoney } from "@/lib/format";
import { sectionTitle } from "./styles";

interface Row {
  label: string;
  value: number;
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
            <td className="py-2 text-right">{formatMoney(row.value)}</td>
          </tr>
        ))}
        <tr className="border-b border-border font-medium">
          <th scope="row" className="py-2 text-left font-medium">
            {total.label}
          </th>
          <td className="py-2 text-right">{formatMoney(total.value)}</td>
        </tr>
      </tbody>
    </table>
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
    </section>
  );
}
