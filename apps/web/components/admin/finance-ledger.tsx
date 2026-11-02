"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatMoney as money } from "../../../../packages/contracts/src/money";
import {
  FinanceEmpty,
  FinanceStatus,
  financeDate,
  financeLabel,
  financeRequest,
} from "./finance-ui";
type Row = Record<string, any>;
export function FinanceLedger({
  orderId,
  orderLink,
}: {
  orderId?: string;
  orderLink: (id: string) => string;
}) {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const page = Math.max(1, Number(params.get("finPage")) || 1),
    search = params.get("finSearch") || "",
    source = params.get("finSource") === "legacy" ? "legacy" : "provider";
  const [data, setData] = useState<Row>(),
    [error, setError] = useState(""),
    [draft, setDraft] = useState(search);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError("");
    void financeRequest(
      `money/ledger?${new URLSearchParams({ page: String(page), search, source, ...(orderId ? { orderId } : {}) })}`,
    )
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [page, search, source, orderId]);
  const change = (values: Record<string, string>) => {
    const q = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) q.set(key, value);
    router.push(`${pathname}?${q}`, { scroll: false });
  };
  return (
    <section className="finance-panel">
      <h2>Order ledger checks</h2>
      <p>
        Compare verified funding with held, released and refunded produce principal. Shipping is
        accounted for separately.
      </p>
      <form
        className="finance-filters"
        onSubmit={(e) => {
          e.preventDefault();
          change({ finSearch: draft, finPage: "1" });
        }}
      >
        <label>
          Search order reference
          <input value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <label>
          Ledger source
          <select
            value={source}
            onChange={(e) => change({ finSource: e.target.value, finPage: "1" })}
          >
            <option value="provider">Provider orders (current environment)</option>
            <option value="legacy">Legacy marketplace records</option>
          </select>
        </label>
        <button>Search</button>
      </form>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {!data && !error ? (
        <p role="status">Loading ledger checks…</p>
      ) : data?.items.length ? (
        <>
          <div className="finance-table-scroll">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Order / created</th>
                  <th>Funded</th>
                  <th>Held</th>
                  <th>Released</th>
                  <th>Refunded</th>
                  <th>Ledger check</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r: Row) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.reference}</strong>
                      <small>{financeDate(r.createdAt)}</small>
                    </td>
                    <td>{money(r.fundedMinor)}</td>
                    <td>{money(r.heldMinor)}</td>
                    <td>{money(r.releasedMinor)}</td>
                    <td>{money(r.refundedMinor)}</td>
                    <td>
                      <FinanceStatus value={r.balanced ? "BALANCED" : "EXCEPTION"} />
                    </td>
                    <td>
                      {source === "provider" ? (
                        <Link href={orderLink(r.id)}>Order finance →</Link>
                      ) : (
                        <Link href={`/admin/orders?id=${r.id}`}>View original order →</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="finance-pagination">
            <p>
              {data.total} {data.mode} records · Page {page}
            </p>
            <div>
              <button
                className="secondary"
                disabled={page <= 1}
                onClick={() => change({ finPage: String(page - 1) })}
              >
                Previous
              </button>
              <button
                className="secondary"
                disabled={page * 20 >= data.total}
                onClick={() => change({ finPage: String(page + 1) })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        data && <FinanceEmpty>No ledger entries match these filters.</FinanceEmpty>
      )}
    </section>
  );
}
export function FinanceReportTables({ summary }: { summary: Row }) {
  return (
    <div className="finance-overview-grid">
      {[
        {
          title: "Order balances by status",
          rows: summary.orderStates || [],
          columns: [
            ["totalMinor", "Order value"],
            ["heldMinor", "Held"],
            ["releasedMinor", "Released"],
            ["refundedMinor", "Refunded"],
          ],
        },
        {
          title: "Produce ledger movements",
          rows: summary.ledgerStates || [],
          columns: [
            ["amountMinor", "Principal"],
            ["feeMinor", "Commission"],
          ],
        },
      ].map((group) => (
        <section className="finance-panel" key={group.title}>
          <h2>{group.title}</h2>
          <p>Provider orders · {summary.mode} · all time</p>
          {group.rows.length ? (
            <div className="finance-table-scroll">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Status / type</th>
                    <th>Records</th>
                    {group.columns.map(([key, label]) => (
                      <th key={key}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((r: Row) => (
                    <tr key={r.status || r.kind}>
                      <td>{financeLabel(r.status || r.kind)}</td>
                      <td>{r._count}</td>
                      {group.columns.map(([key]) => (
                        <td key={key}>{money(r._sum[key] || "0")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No records yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}
