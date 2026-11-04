"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatMoney as money } from "../../../../packages/contracts/src/money";
import { FinanceLedger, FinanceReportTables } from "./finance-ledger";
import { FinanceOperations } from "./finance-operations";
import { refundState } from "./refund-state";
import { MoneyActions } from "./money-actions";
import {
  FinanceEmpty,
  FinanceStatus,
  financeDate,
  financeLabel,
  financeRequest,
} from "./finance-ui";
type Row = Record<string, any>;
const paymentStates = [
  "OPEN",
  "SUCCEEDED",
  "EXCEPTION",
  "REFUNDED",
  "FAILED",
  "EXPIRED",
  "UNKNOWN",
  "BLOCKED",
];
const operationStates = [
  "REQUESTED",
  "QUEUED",
  "PROCESSING",
  "PROVIDER_PENDING",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
  "UNKNOWN",
  "REJECTED",
];
export function MoneyOperations({
  orderId,
  manage = false,
  view = "reconciliation",
}: {
  orderId?: string;
  manage?: boolean;
  view?: string;
}) {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const defaultTab = view === "withdrawals" ? "operations" : "overview";
  const tab = params.get("finTab") || defaultTab;
  const allowed = [
    "overview",
    "payments",
    "operations",
    "recovery",
    "funding",
    "ledger",
    ...(view === "withdrawals" ? ["legacy"] : []),
  ];
  const active = allowed.includes(tab) ? tab : defaultTab;
  const search = params.get("finSearch") || "",
    status = params.get("finStatus") || "ALL",
    from = params.get("finFrom") || "",
    to = params.get("finTo") || "";
  const page = Math.max(1, Number(params.get("finPage")) || 1);
  const [draft, setDraft] = useState(search),
    [summary, setSummary] = useState<Row>(),
    [base, setBase] = useState<Row>(),
    [records, setRecords] = useState<Row>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => setDraft(search), [search]);
  const update = useCallback(
    (changes: Record<string, string>) => {
      const q = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) q.set(key, value);
        else q.delete(key);
      }
      router.push(`${pathname}?${q}`, { scroll: false });
    },
    [params, pathname, router],
  );
  const scope = orderId ? `?orderId=${orderId}` : "";
  useEffect(() => {
    let live = true;
    setError("");
    void Promise.all([financeRequest(`money/summary${scope}`), financeRequest(`money${scope}`)])
      .then(([s, b]) => {
        if (live) {
          setSummary(s);
          setBase(b);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [scope, refresh]);
  useEffect(() => {
    if (!["payments", "operations"].includes(active)) return;
    let live = true;
    setLoading(true);
    setRecords(undefined);
    setError("");
    const q = new URLSearchParams({
      type: active,
      page: String(page),
      search,
      status,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(orderId ? { orderId } : {}),
      ...(view === "withdrawals" && active === "operations" ? { kind: "PAYOUT" } : {}),
    });
    void financeRequest(`money/records?${q}`)
      .then((data) => {
        if (live) setRecords(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [active, page, search, status, from, to, orderId, view, refresh]);
  const rawReturn = params.get("returnTo");
  const back =
    rawReturn && /^\/admin\/(reconciliation|withdrawals|reports)(\?|$)/.test(rawReturn)
      ? rawReturn
      : "/admin/reconciliation";
  const returnPath = orderId ? back : `${pathname}${params.size ? `?${params}` : ""}`;
  const orderLink = (id: string) =>
    `/admin/reconciliation/orders/${id}?returnTo=${encodeURIComponent(returnPath)}`;
  const metrics = summary
    ? [
        ["Verified collections", summary.collectionsMinor, "Produce and shipping principal"],
        [
          "Farmer obligations",
          (BigInt(summary.farmerHeldMinor) + BigInt(summary.farmerAvailableMinor)).toString(),
          "Held and available earnings",
        ],
        ["Unallocated payments", summary.unallocatedMinor, "Requires recovery or refund"],
        ["Earned commission", summary.commissionMinor, "Recognized release journals"],
      ]
    : [];
  const tabs = [
    ...[{ id: "overview", label: view === "reports" ? "Financial overview" : "Overview" }],
    { id: "payments", label: "Payments" },
    {
      id: "operations",
      label: view === "withdrawals" ? "Provider withdrawals" : "Money operations",
    },
    { id: "recovery", label: "Recovery & refunds" },
    { id: "funding", label: "Logistics funding" },
    { id: "ledger", label: "Ledger checks" },
    ...(view === "withdrawals" ? [{ id: "legacy", label: "Legacy withdrawals" }] : []),
  ];
  return (
    <div className="finance-workspace">
      <div className="finance-topline">
        <div>
          {orderId && (
            <Link href={back} className="finance-back">
              ← Back to finance records
            </Link>
          )}
          <p className="finance-eyebrow">
            {orderId ? "ORDER FINANCE" : "FINANCE WORKSPACE"} ·{" "}
            {summary?.mode || "Loading environment"}
          </p>
          <p>
            {orderId
              ? `Order ${orderId}`
              : view === "withdrawals"
                ? "Review payout requests, resolve blocked withdrawals, and track execution."
                : view === "reports"
                  ? "Understand collections, obligations, and recognized earnings."
                  : "Monitor collections, investigate exceptions, and keep fulfillment funded."}
          </p>
        </div>
        <button className="secondary" onClick={() => setRefresh((n) => n + 1)}>
          Refresh records
        </button>
      </div>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      <nav className="finance-tabs" aria-label="Finance views">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`${pathname}?${new URLSearchParams({ ...Object.fromEntries(params), finTab: t.id, finPage: "1", finSearch: "", finStatus: "ALL", finFrom: "", finTo: "" })}`}
            aria-current={active === t.id ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {active === "overview" && (
        <>
          {!summary ? (
            <p role="status">Loading financial summary…</p>
          ) : (
            <>
              <div className="finance-metrics">
                {metrics.map(([label, value, help]) => (
                  <section key={label} className="finance-metric">
                    <p>{label}</p>
                    <strong>{money(value)}</strong>
                    <small>{help}</small>
                  </section>
                ))}
              </div>
              <div className="finance-overview-grid">
                <section className="finance-panel">
                  <div className="finance-section-heading">
                    <div>
                      <h2>Verified collections</h2>
                      <p>Last seven days · Lagos time · principal only</p>
                    </div>
                  </div>
                  <CollectionChart daily={summary.daily} />
                </section>
                <section className="finance-panel">
                  <h2>Needs attention</h2>
                  <p>Open the matching queue to review and take action.</p>
                  <div className="finance-attention">
                    {[
                      [
                        "Unallocated verified funds",
                        money(summary.unallocatedMinor),
                        "payments",
                        "EXCEPTION",
                      ],
                      [
                        "Blocked operations",
                        summary.operationStates
                          .filter((r: Row) => r.status === "BLOCKED")
                          .reduce((n: number, r: Row) => n + r._count, 0),
                        "operations",
                        "BLOCKED",
                      ],
                      [
                        "Unknown provider results",
                        summary.operationStates
                          .filter((r: Row) => r.status === "UNKNOWN")
                          .reduce((n: number, r: Row) => n + r._count, 0),
                        "operations",
                        "UNKNOWN",
                      ],
                    ].map(([label, value, target, state]) => (
                      <button
                        className="secondary"
                        key={label}
                        onClick={() =>
                          update({
                            finTab: target,
                            finStatus: state,
                            finPage: "1",
                            finSearch: "",
                            finFrom: "",
                            finTo: "",
                          })
                        }
                      >
                        <span>{label}</span>
                        <strong>{value} →</strong>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <section className="finance-panel">
                <h2>Financial position</h2>
                <p>All-time values in {summary.mode}. Gross collections are not platform income.</p>
                <dl className="finance-facts">
                  {[
                    ["Shipping collected", summary.shippingMinor],
                    ["Processing fees", summary.processingFeesMinor],
                    ["Farmer funds awaiting release", summary.farmerHeldMinor],
                    ["Farmer available earnings", summary.farmerAvailableMinor],
                    ["Confirmed refunds", summary.refundedMinor],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{money(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="finance-panel">
                <h2>Provider connection & balance observations</h2>
                <div className="finance-connection">
                  <FinanceStatus value={base?.readiness.enabled ? "ENABLED" : "DISABLED"} />
                  <span>
                    Webhook {base?.readiness.webhookConfigured ? "configured" : "missing"}
                  </span>
                  <span>Summary updated {financeDate(summary.asOf)}</span>
                </div>
                {base?.reconciliations?.[0] ? (
                  <dl className="finance-facts">
                    <div>
                      <dt>Last reconciliation</dt>
                      <dd>{financeDate(base.reconciliations[0].createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Observed provider available balance</dt>
                      <dd>{money(base.reconciliations[0].platformAvailableMinor)}</dd>
                    </div>
                    <div>
                      <dt>Observed shipping wallet</dt>
                      <dd>
                        {base.reconciliations[0].shippingWalletMinor === null
                          ? "Unavailable"
                          : money(base.reconciliations[0].shippingWalletMinor)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p>
                    No balance observation yet. A configured connection does not verify current cash
                    availability.
                  </p>
                )}
                {manage && <MoneyActions manage toolsOnly />}
              </section>
            </>
          )}
        </>
      )}
      {["payments", "operations"].includes(active) && (
        <section className="finance-panel">
          <div className="finance-section-heading">
            <div>
              <h2>
                {active === "payments"
                  ? "Customer payments"
                  : view === "withdrawals"
                    ? "Provider withdrawal requests"
                    : "Provider money operations"}
              </h2>
              <p>
                {records
                  ? `${records.total} matching records`
                  : "Search the complete record history"}{" "}
                · Dates shown in Lagos time
              </p>
            </div>
          </div>
          <form
            className="finance-filters"
            onSubmit={(e) => {
              e.preventDefault();
              update({ finSearch: draft, finPage: "1" });
            }}
          >
            <label>
              Search reference
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Order, transaction or provider reference"
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => update({ finStatus: e.target.value, finPage: "1" })}
              >
                <option value="ALL">All statuses</option>
                {(active === "payments" ? paymentStates : operationStates).map((s) => (
                  <option key={s} value={s}>
                    {financeLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From
              <input
                type="date"
                value={from}
                onChange={(e) => update({ finFrom: e.target.value, finPage: "1" })}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => update({ finTo: e.target.value, finPage: "1" })}
              />
            </label>
            <button>Search</button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                update({ finSearch: "", finStatus: "ALL", finFrom: "", finTo: "", finPage: "1" })
              }
            >
              Clear
            </button>
          </form>
          {loading ? (
            <p role="status">Loading financial records…</p>
          ) : records?.items.length ? (
            <>
              <div className="finance-table-scroll">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Record / order</th>
                      <th>Type</th>
                      <th className="finance-amount">Amount</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.items.map((row: Row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.orderReference || "Account operation"}</strong>
                          <small>{row.id}</small>
                        </td>
                        <td>
                          {financeLabel(row.kind)}
                          {row.method && <small>{financeLabel(row.method)}</small>}
                        </td>
                        <td className="finance-amount">
                          {money(row.amountMinor)}
                          <small>
                            {active === "payments"
                              ? `Verified ${money(row.paidMinor)}`
                              : `Fee ${money(row.feeMinor)}`}
                          </small>
                        </td>
                        <td>
                          {row.kind?.startsWith("REFUND") ? (
                            <span className={`finance-badge ${refundState(row as any).tone}`}>
                              {refundState(row as any).label}
                            </span>
                          ) : (
                            <FinanceStatus value={row.status} />
                          )}
                          {(row.failureCode || row.exceptionCode) &&
                            (!row.kind?.startsWith("REFUND") ||
                              refundState(row as any).needsHelp) && (
                              <small className="finance-error-code">
                                {financeLabel(row.failureCode || row.exceptionCode)}
                              </small>
                            )}
                        </td>
                        <td>{financeDate(row.createdAt)}</td>
                        <td>
                          <Link
                            className="finance-review-link"
                            href={`/admin/reconciliation/records/${active}/${row.id}?returnTo=${encodeURIComponent(`${pathname}${params.size ? `?${params}` : ""}`)}`}
                            aria-label={`Review ${row.orderReference || row.id}`}
                          >
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="finance-pagination">
                <p>
                  Page {page} of {Math.max(1, Math.ceil(records.total / 20))} · {records.total}{" "}
                  records
                </p>
                <div>
                  <button
                    className="secondary"
                    disabled={page <= 1}
                    onClick={() => update({ finPage: String(page - 1) })}
                  >
                    Previous
                  </button>
                  <button
                    className="secondary"
                    disabled={page * 20 >= records.total}
                    onClick={() => update({ finPage: String(page + 1) })}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            !error && <FinanceEmpty>Try another search or clear the filters.</FinanceEmpty>
          )}
        </section>
      )}
      {active === "ledger" && <FinanceLedger orderId={orderId} orderLink={orderLink} />}
      {active === "overview" && view === "reports" && summary && (
        <FinanceReportTables summary={summary} />
      )}
      {["recovery", "funding"].includes(active) && (
        <FinanceOperations
          key={`${active}:${refresh}`}
          orderId={orderId}
          manage={manage}
          view={active as "recovery" | "funding"}
          orderLink={orderLink}
        />
      )}
      {active === "legacy" && (
        <div className="finance-callout">
          <strong>Legacy withdrawal records</strong>
          <p>
            These records use the original authorization workflow. Provider payouts are reviewed in
            Provider withdrawals.
          </p>
        </div>
      )}
      {orderId && manage && (
        <section className="finance-panel">
          <h2>Order settlement controls</h2>
          <p>
            Release, resolve a financial hold, or request an eligible refund. Provider verification
            and authorization checks apply.
          </p>
          <MoneyActions orderId={orderId} manage={manage} />
        </section>
      )}
    </div>
  );
}
function CollectionChart({ daily }: { daily: Row[] }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${today}T12:00:00+01:00`);
    date.setUTCDate(date.getUTCDate() - 6 + i);
    const key = date.toISOString().slice(0, 10);
    return { day: key, amount: BigInt(daily.find((r) => r.day === key)?.amountMinor || "0") };
  });
  const max = days.reduce((n, d) => (d.amount > n ? d.amount : n), 0n);
  return (
    <div
      className="finance-chart"
      role="img"
      aria-label={`Verified collections over seven days: ${days.map((d) => `${d.day}: ${money(d.amount.toString())}`).join("; ")}`}
    >
      {days.map((d) => (
        <div className="finance-chart-column" key={d.day}>
          <span>{money(d.amount.toString())}</span>
          <div className="finance-chart-track">
            <div style={{ height: `${max ? Number((d.amount * 10000n) / max) / 100 : 0}%` }} />
          </div>
          <small>
            {new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric" }).format(
              new Date(`${d.day}T12:00:00+01:00`),
            )}
          </small>
        </div>
      ))}
    </div>
  );
}
