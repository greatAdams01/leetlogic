"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney as money } from "../../../../packages/contracts/src/money";
import {
  FinanceDrawer,
  FinanceEmpty,
  FinanceSecurity,
  FinanceStatus,
  financeDate,
  financeLabel,
  financeRequest,
  useFinanceMutation,
} from "./finance-ui";
type Row = Record<string, any>;
export function FinanceOperations({
  orderId,
  manage,
  view,
  orderLink,
}: {
  orderId?: string;
  manage: boolean;
  view: "recovery" | "funding";
  orderLink: (id: string) => string;
}) {
  const [data, setData] = useState<Row>(),
    [cases, setCases] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<{ type: string; id: string }>(),
    [checked, setChecked] = useState<string[]>([]);
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const query = params.get("finSearch") || "",
    status = params.get("finStatus") || "ALL",
    page = Math.max(1, Number(params.get("finPage")) || 1);
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const load = useCallback(async () => {
    const suffix = orderId ? `?orderId=${orderId}` : "";
    const [f, r] = await Promise.all([
      financeRequest(`money/finance${suffix}`),
      financeRequest(`money/recoveries${suffix}`),
    ]);
    setData(f);
    setCases(r.items || []);
    setError("");
  }, [orderId]);
  useEffect(() => {
    let running = false,
      alive = true;
    const update = () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      void load()
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          running = false;
        });
    };
    update();
    const timer = setInterval(update, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [load]);
  const update = (changes: Record<string, string>) => {
    const q = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) q.set(key, value);
      else q.delete(key);
    }
    router.push(`${pathname}?${q}`, { scroll: false });
  };
  if (error && !data)
    return (
      <p role="alert" className="live-error">
        {error}
      </p>
    );
  if (!data)
    return (
      <p role="status">Loading {view === "funding" ? "logistics funding" : "recovery"} records…</p>
    );
  if (!data.enabled)
    return (
      <div className="finance-callout">
        <h2>{view === "funding" ? "Logistics funding" : "Recovery & refunds"} is not enabled</h2>
        <p>
          The rollout switch is off for this environment. Payment history and money operations
          remain available in their respective views.
        </p>
      </div>
    );
  const term = query.trim().toLowerCase();
  const rows = (view === "recovery" ? cases : data.shipments).filter(
    (r: Row) =>
      (status === "ALL" ||
        (view === "recovery"
          ? r.state === status
          : status === "READY"
            ? r.bookingReady
            : status === "UNCERTAIN"
              ? r.uncertain
              : r.state === status)) &&
      (!term ||
        [r.reference, r.title, r.orderId, r.courier, r.state]
          .join(" ")
          .toLowerCase()
          .includes(term)),
  );
  const selectedShipments = data.shipments.filter(
    (s: Row) => checked.includes(s.deliveryId) && s.bookingReady,
  );
  const selectedTotal = selectedShipments.reduce(
    (n: bigint, s: Row) => n + BigInt(s.courierCostMinor || "0"),
    0n,
  );
  const item =
    selected?.type === "case"
      ? cases.find((r) => r.id === selected.id)
      : data.batches.find((r: Row) => r.id === selected?.id);
  return (
    <div className="finance-operations">
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {data.heartbeat.stale && (
        <div className="finance-callout danger" role="alert">
          <strong>Payment worker needs attention</strong>
          <p>Its heartbeat is stale. Review overdue refunds and restore the worker.</p>
        </div>
      )}
      {view === "funding" ? (
        <>
          <div className="finance-metrics">
            <section className="finance-metric">
              <p>Immediate funding shortfall</p>
              <strong>
                {data.funding.verified ? money(data.funding.fundingShortfallMinor) : "Unverified"}
              </strong>
              <small>
                {data.funding.verified
                  ? "For booking-ready shipments"
                  : "Refresh the balance and reconcile uncertain purchases"}
              </small>
            </section>
            <section className="finance-metric">
              <p>Booking-ready courier costs</p>
              <strong>{money(data.funding.bookingReadyMinor)}</strong>
              <small>Current provider wallet costs</small>
            </section>
            <section className="finance-metric">
              <p>Usable wallet balance</p>
              <strong>
                {data.funding.usableWalletMinor === null
                  ? "Unverified"
                  : money(data.funding.usableWalletMinor)}
              </strong>
              <small>After local booking commitments</small>
            </section>
            <section className="finance-metric">
              <p>Transfers awaiting verification</p>
              <strong>{money(data.funding.recordedUnverifiedTransfersMinor)}</strong>
              <small>Excluded from usable funds</small>
            </section>
          </div>
          <section className="finance-panel">
            <div className="finance-section-heading">
              <div>
                <h2>Shipbubble wallet</h2>
                <p>
                  Observed {financeDate(data.funding.checkedAt)} · {data.mode}
                </p>
              </div>
              {manage && (
                <button
                  className="secondary"
                  onClick={() =>
                    void financeRequest("money/finance/refresh", {})
                      .then(load)
                      .catch((e) => setError(e.message))
                  }
                >
                  Refresh wallet balance
                </button>
              )}
            </div>
            <dl className="finance-facts">
              <div>
                <dt>Provider balance</dt>
                <dd>
                  {data.funding.walletMinor === null
                    ? "Unavailable"
                    : money(data.funding.walletMinor)}
                </dd>
              </div>
              <div>
                <dt>Existing booking commitments</dt>
                <dd>{money(data.funding.committedMinor)}</dd>
              </div>
            </dl>
            <p className="finance-muted">
              Record manual bank transfers here. Funds become usable only after verification.
              Confirmed deposits are already included in the observed wallet balance.
            </p>
          </section>
        </>
      ) : (
        <div className="finance-metrics">
          {[
            ["Refunds due", data.summary.refundDueMinor],
            ["Refunds processing", data.summary.refundProcessingMinor],
            ["Refunds blocked", data.summary.refundBlockedMinor],
            ["Refunds completed", data.summary.refundCompletedMinor],
          ].map(([label, value]) => (
            <section key={label} className="finance-metric">
              <p>{label}</p>
              <strong>{money(value)}</strong>
              <small>Refundable produce and shipping principal</small>
            </section>
          ))}
        </div>
      )}
      <section className="finance-panel">
        <div className="finance-section-heading">
          <div>
            <h2>
              {view === "funding" ? "Shipment funding queue" : "Recent payment recovery cases"}
            </h2>
            <p>
              {view === "funding"
                ? "Select booking-ready shipments to plan a funding batch. Conditional recovery shipments are excluded."
                : "Latest 100 cases. Confirm stock and consent before allocating payment. Staff acknowledgement does not extend the deadline."}
            </p>
          </div>
          {view === "funding" && manage && data.flags.funding && (
            <button
              disabled={!selectedShipments.length}
              onClick={() => setSelected({ type: "new", id: "new" })}
            >
              Plan funding ({selectedShipments.length})
            </button>
          )}
        </div>
        <form
          className="finance-filters"
          onSubmit={(e) => {
            e.preventDefault();
            update({ finSearch: draft, finPage: "1" });
          }}
        >
          <label>
            Search orders
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Order reference, produce or courier"
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => update({ finStatus: e.target.value, finPage: "1" })}
            >
              <option value="ALL">All statuses</option>
              {(view === "funding"
                ? ["READY", "UNCERTAIN", "BOOKED", "TOPUP_REQUIRED"]
                : [...new Set(cases.map((r) => r.state))]
              ).map((s) => (
                <option key={s} value={s}>
                  {financeLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <button>Search</button>
          <button
            type="button"
            className="secondary"
            onClick={() => update({ finSearch: "", finStatus: "ALL", finPage: "1" })}
          >
            Clear
          </button>
        </form>
        {rows.length ? (
          <>
            <div className="finance-table-scroll">
              <table className="finance-table">
                <thead>
                  <tr>
                    {view === "funding" && <th>Select</th>}
                    <th>Order</th>
                    <th>{view === "funding" ? "Collected / courier cost" : "Payment / consent"}</th>
                    <th>Status</th>
                    <th>Refund deadline</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * 20, page * 20).map((r: Row) => (
                    <tr key={r.id || r.deliveryId}>
                      {view === "funding" && (
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Fund ${r.reference}`}
                            checked={checked.includes(r.deliveryId)}
                            disabled={!r.bookingReady}
                            onChange={(e) =>
                              setChecked((current) =>
                                e.target.checked
                                  ? [...current, r.deliveryId]
                                  : current.filter((id) => id !== r.deliveryId),
                              )
                            }
                          />
                        </td>
                      )}
                      <td>
                        <strong>{r.reference}</strong>
                        <small>{r.title || r.courier || "Courier not selected"}</small>
                      </td>
                      <td>
                        {view === "funding" ? (
                          <>
                            {money(r.shippingCollectedMinor)}
                            <small>
                              Cost{" "}
                              {r.courierCostMinor === null ? "Unquoted" : money(r.courierCostMinor)}{" "}
                              · Surplus {money(r.refundableShippingSurplusMinor)}
                            </small>
                          </>
                        ) : (
                          <>
                            {money(r.payment.amountMinor)}
                            <small>
                              Farmer {r.farmerConfirmedAt ? "confirmed" : "pending"} · Buyer{" "}
                              {r.proposal?.buyerAcceptedAt ? "accepted" : "pending"}
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        <FinanceStatus value={r.state} />
                        {r.conditionalRecovery && <small>Conditional recovery</small>}
                      </td>
                      <td>{financeDate(r.deadline?.refundDueAt)}</td>
                      <td>
                        {view === "recovery" ? (
                          <Link
                            className="finance-review-link"
                            href={`/admin/reconciliation/records/recoveries/${r.id}?returnTo=${encodeURIComponent(`${pathname}${params.size ? `?${params}` : ""}`)}`}
                          >
                            Review case →
                          </Link>
                        ) : (
                          <Link href={orderLink(r.orderId)}>Order finance →</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="finance-pagination">
              <span>
                {rows.length} matching records · Page {page}
              </span>
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
                  disabled={page * 20 >= rows.length}
                  onClick={() => update({ finPage: String(page + 1) })}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <FinanceEmpty>
            {query || status !== "ALL"
              ? "Clear the filters to see more records."
              : view === "funding"
                ? "No shipments currently need funding."
                : "No payment recovery cases in this environment."}
          </FinanceEmpty>
        )}
      </section>
      {view === "recovery" && (
        <section className="finance-panel">
          <h2>Deadline & incident queue</h2>
          <p>
            Refund initiation follows each order’s recorded deadline, using the configured
            marketplace recovery period. Staff acknowledgement does not pause it. Provider credit
            may take longer.
          </p>
          {data.deadlines.filter((d: Row) => !["SECURED", "REFUNDED", "ADMIN_RESOLVED"].includes(d.state)).length ? (
            <div className="finance-table-scroll">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Refund state</th>
                    <th>Due</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deadlines
                    .filter((d: Row) => !["SECURED", "REFUNDED", "ADMIN_RESOLVED"].includes(d.state))
                    .map((d: Row) => (
                      <tr key={d.orderId}>
                        <td>
                          <Link href={orderLink(d.orderId)}>
                            {data.shipments.find((s: Row) => s.orderId === d.orderId)?.reference ||
                              d.orderId}
                          </Link>
                        </td>
                        <td>
                          <FinanceStatus value={d.state} />
                        </td>
                        <td>{financeDate(d.refundDueAt)}</td>
                        <td>{financeLabel(d.failureCode) || "Monitor provider confirmation"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No unresolved deadlines.</p>
          )}
          {data.alerts.length > 0 && (
            <details>
              <summary>{data.alerts.length} active operational alerts</summary>
              <ul>
                {data.alerts.map((a: Row) => (
                  <li key={a.key}>
                    {financeLabel(a.code)} · {a.orderId || "Provider account"}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {view === "funding" && (
        <section className="finance-panel">
          <h2>Manual funding batches</h2>
          <p>Latest 100 batches. Planning and recording a transfer does not move money.</p>
          {data.batches.length ? (
            <div className="finance-table-scroll">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Batch / source</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batches.map((b: Row) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.sourceLabel}</strong>
                        <small>{b.transferReference || b.id}</small>
                      </td>
                      <td>{money(b.amountMinor)}</td>
                      <td>
                        <FinanceStatus value={b.state} />
                      </td>
                      <td>{financeDate(b.createdAt)}</td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => setSelected({ type: "batch", id: b.id })}
                        >
                          Review transfer →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <FinanceEmpty>Select booking-ready shipments to create a funding plan.</FinanceEmpty>
          )}
        </section>
      )}
      {selected?.type === "batch" && item && (
        <FinanceDrawer
          key={item.id}
          title="Funding transfer"
          onClose={() => setSelected(undefined)}
        >
          <FundingReview item={item} manage={manage} refresh={load} />
        </FinanceDrawer>
      )}
      {selected?.type === "new" && (
        <FinanceDrawer
          title="Plan a shipping-wallet transfer"
          onClose={() => setSelected(undefined)}
        >
          <NewFunding
            shipments={selectedShipments}
            total={selectedTotal}
            refresh={load}
            done={() => setSelected(undefined)}
          />
        </FinanceDrawer>
      )}
    </div>
  );
}
export function RecoveryReview({
  item: r,
  manage,
  refresh,
  orderLink,
}: {
  item: Row;
  manage: boolean;
  refresh: () => Promise<void>;
  orderLink: (id: string) => string;
}) {
  const mutation = useFinanceMutation(refresh),
    key = useRef("");
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10)),
    [minutes, setMinutes] = useState("60"),
    [notes, setNotes] = useState(""),
    [refundChoice, setRefundChoice] = useState(false);
  const closed =
    r.allocatedAt ||
    ["REFUND_REQUIRED", "REFUNDED"].includes(r.state) ||
    !r.deadline ||
    r.deadline.state !== "ACTIVE" ||
    new Date(r.deadline.refundDueAt).getTime() <= Date.now();
  const run = (path: string, body: Row) =>
    void mutation
      .action(`recoveries/${r.id}/${path}`, { reason: mutation.reason, ...body })
      .catch(() => {});
  return (
    <>
      <div className="finance-record-heading">
        <FinanceStatus
          value={r.deadline?.state && r.deadline.state !== "ACTIVE" ? r.deadline.state : r.state}
        />
        <strong>{money(r.payment.amountMinor)}</strong>
      </div>
      <dl className="finance-facts">
        {[
          ["Produce", r.title],
          [
            "Farmer confirmation",
            r.farmerConfirmedAt
              ? financeDate(r.farmerConfirmedAt)
              : closed
                ? "No confirmation recorded"
                : "Required",
          ],
          ["Stock reserved until", financeDate(r.reservationUntil)],
          [
            "Buyer proposal",
            r.proposal?.buyerAcceptedAt
              ? `Accepted version ${r.version}`
              : closed
                ? "No accepted recovery proposal"
                : `Awaiting acceptance · version ${r.version}`,
          ],
          ["Proposal expiry", financeDate(r.proposal?.expiresAt)],
          ["Refund due", financeDate(r.deadline?.refundDueAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Link className="finance-detail-link" href={orderLink(r.orderId)}>
        Open complete order finance →
      </Link>
      {closed && (
        <div className="finance-action-guide">
          <h3>Recovery is closed</h3>
          <p>
            {r.allocatedAt
              ? "This payment has been allocated. Review the order’s fulfillment and refund eligibility."
              : "Do not reconfirm stock or approve fulfillment. Follow the existing refund obligation and reconcile any uncertain shipment or money operation."}
          </p>
          {r.deadline?.paymentId && (
            <Link
              className="finance-review-link"
              href={`/admin/reconciliation/records/payments/${r.deadline.paymentId}?returnTo=${encodeURIComponent(`/admin/reconciliation/records/recoveries/${r.id}`)}`}
            >
              Review payment & refund status →
            </Link>
          )}
        </div>
      )}
      {manage && !closed && (
        <section className="finance-panel">
          <h3>Unable to fulfill this paid order?</h3>
          <p>
            Send this case to the refund queue. This ends recovery; it does not mean the provider
            has completed the refund.
          </p>
          {!refundChoice ? (
            <button className="finance-danger-button" onClick={() => setRefundChoice(true)}>
              Start refund resolution
            </button>
          ) : (
            <>
              <h4>Review & authorize refund resolution</h4>
              <p>
                Verified principal: {money(r.payment.amountMinor)}. The existing refund service will
                check shipments, eligibility and prior refunds before submission.
              </p>
              <FinanceSecurity mutation={mutation} />
              <div className="finance-review-actions">
                <button
                  className="finance-danger-button"
                  disabled={!mutation.ready}
                  onClick={() => run("decline", {})}
                >
                  Confirm refund resolution
                </button>
                <button
                  className="secondary"
                  disabled={mutation.busy}
                  onClick={() => setRefundChoice(false)}
                >
                  Cancel action
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {manage && !closed && !refundChoice && (
        <details className="finance-panel">
          <summary>Continue fulfillment recovery instead</summary>
          <p>
            Use this path only when the original order can still be fulfilled with the required
            buyer and farmer confirmations.
          </p>
          <FinanceSecurity mutation={mutation} />
          <section className="finance-panel">
            <h3>Confirm the farmer’s availability</h3>
            <p>
              Record a completed phone confirmation of original stock, packing and pickup details.
            </p>
            <label>
              Confirmed pickup date
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </label>
            <label>
              Preparation time (minutes)
              <input
                type="number"
                min="0"
                max="1440"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <label>
              Completed call details
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={700} />
            </label>
            <button
              disabled={!mutation.ready || !pickupDate || !notes}
              onClick={() =>
                run("farmer", {
                  pickupDate,
                  preparationMinutes: Number(minutes),
                  notes,
                  phoneConfirmation: true,
                })
              }
            >
              Record farmer confirmation
            </button>
          </section>
          <div className="finance-review-actions">
            <button
              className="secondary"
              disabled={!mutation.ready || !r.farmerConfirmedAt}
              onClick={() => run("proposal", {})}
            >
              Prepare fresh proposal
            </button>
            <button
              disabled={!mutation.ready || r.state !== "READY_FOR_APPROVAL"}
              onClick={() => {
                key.current ||= crypto.randomUUID();
                run("approve", { version: r.version, idempotencyKey: key.current });
              }}
            >
              Approve payment allocation
            </button>
          </div>
        </details>
      )}
    </>
  );
}
function NewFunding({
  shipments,
  total,
  refresh,
  done,
}: {
  shipments: Row[];
  total: bigint;
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const mutation = useFinanceMutation(refresh),
    [amount, setAmount] = useState(total.toString()),
    [source, setSource] = useState(""),
    [destination, setDestination] = useState("");
  return (
    <>
      <p>
        {shipments.length} booking-ready shipments · Provider cost{" "}
        <strong>{money(total.toString())}</strong>
      </p>
      <ul>
        {shipments.map((s) => (
          <li key={s.deliveryId}>
            {s.reference} · {money(s.courierCostMinor)}
          </li>
        ))}
      </ul>
      <label>
        Transfer amount (kobo)
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <label>
        Source business account label
        <input value={source} onChange={(e) => setSource(e.target.value)} />
      </label>
      <label>
        Verified Shipbubble destination
        <input value={destination} onChange={(e) => setDestination(e.target.value)} />
      </label>
      <FinanceSecurity mutation={mutation} />
      <button
        disabled={!mutation.ready || !shipments.length || !amount || !source || !destination}
        onClick={() =>
          void mutation
            .action("funding", {
              amountMinor: amount,
              sourceLabel: source,
              destination,
              shipmentIds: shipments.map((s) => s.deliveryId),
              reason: mutation.reason,
            })
            .then(done)
            .catch(() => {})
        }
      >
        Create funding plan
      </button>
    </>
  );
}
function FundingReview({
  item: b,
  manage,
  refresh,
}: {
  item: Row;
  manage: boolean;
  refresh: () => Promise<void>;
}) {
  const mutation = useFinanceMutation(refresh),
    [reference, setReference] = useState(""),
    [statement, setStatement] = useState(""),
    [fileError, setFileError] = useState("");
  const run = (suffix: string, body: Row) =>
    void mutation
      .action(`funding/${b.id}/${suffix}`, { reason: mutation.reason, ...body })
      .catch(() => {});
  return (
    <>
      <div className="finance-record-heading">
        <FinanceStatus value={b.state} />
        <strong>{money(b.amountMinor)}</strong>
      </div>
      <dl className="finance-facts">
        {[
          ["Source", b.sourceLabel],
          ["Destination", b.destination],
          ["Transfer reference", b.transferReference || "Not recorded"],
          ["Created", financeDate(b.createdAt)],
          ["Verified", financeDate(b.verifiedAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <a
        className="finance-detail-link"
        href={`/api/admin/money/funding/${b.id}/evidence`}
        target="_blank"
        rel="noreferrer"
      >
        View private evidence ↗
      </a>
      {manage && ["PLANNED", "TRANSFER_RECORDED"].includes(b.state) && (
        <>
          <FinanceSecurity mutation={mutation} />
          <label>
            Bank transfer reference
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label>
            Statement reconciliation evidence / reference
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              minLength={10}
              maxLength={500}
            />
          </label>
          {b.state === "PLANNED" && (
            <button
              disabled={!mutation.ready || !reference || statement.length < 10}
              onClick={() =>
                run("record", { transferReference: reference, statementReference: statement })
              }
            >
              Record completed transfer
            </button>
          )}
          <label>
            Private evidence (PDF/JPEG/PNG, up to 500 KB)
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={!mutation.ready}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 512000) {
                  setFileError("Evidence must be at most 500 KB.");
                  return;
                }
                setFileError("");
                const reader = new FileReader();
                reader.onload = () =>
                  run("evidence", { base64: String(reader.result).split(",")[1], mime: file.type });
                reader.onerror = () => setFileError("The file could not be read. Try again.");
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {fileError && <p role="alert">{fileError}</p>}
          {b.state === "TRANSFER_RECORDED" && (
            <button
              disabled={!mutation.ready || statement.length < 10}
              onClick={() =>
                run("verify", { statementReference: statement, reconciledStatement: true })
              }
            >
              Verify reconciled funding
            </button>
          )}
          <div className="finance-review-actions">
            <button
              className="finance-danger-button"
              disabled={!mutation.ready}
              onClick={() => run("close", { state: "FAILED" })}
            >
              Mark transfer failed
            </button>
            <button
              className="secondary"
              disabled={!mutation.ready}
              onClick={() => run("close", { state: "CANCELLED" })}
            >
              Cancel batch
            </button>
          </div>
        </>
      )}
    </>
  );
}
