"use client";
import { userFacingError } from "../../lib/user-facing-error";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney as money } from "../../../../packages/contracts/src/money";
import { FinanceStatus, financeDate, financeLabel, financeRequest } from "./finance-ui";
import { refundState } from "./refund-state";
import { RecoveryReview } from "./finance-operations";
import { MoneyActions } from "./money-actions";
export function financeReturnPath(value: string | null) {
  if (!value?.startsWith("/admin/")) return "/admin/reconciliation";
  try {
    const url = new URL(value, "https://admin.invalid");
    if (
      url.origin === "https://admin.invalid" &&
      /^\/admin\/(reconciliation|withdrawals|reports)(?:\/(?:orders\/[a-f0-9-]{36}|records\/(?:payments|operations|recoveries)\/[a-f0-9-]{36}))?$/.test(
        url.pathname,
      )
    )
      return url.pathname + url.search;
  } catch {}
  return "/admin/reconciliation";
}
export function MoneyRecordReview({
  recordType,
  recordId,
  manage = false,
}: {
  recordType: "payments" | "operations" | "recoveries";
  recordId: string;
  manage?: boolean;
}) {
  const params = useSearchParams(),
    back = financeReturnPath(params.get("returnTo"));
  const [record, setRecord] = useState<any>(),
    [error, setError] = useState("");
  const readVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++readVersion.current;
    const data = await financeRequest(
      recordType === "recoveries"
        ? `money/recoveries/${recordId}`
        : `money/records/${recordType}/${recordId}`,
    );
    if (version === readVersion.current) {
      setRecord(data);
      setError("");
    }
  }, [recordId, recordType]);
  useEffect(() => {
    let active = true;
    setRecord(undefined);
    setError("");
    const refresh = () => {
      if (document.visibilityState !== "hidden")
        void load().catch((e) => {
          if (active) setError(userFacingError(e));
        });
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      readVersion.current++;
      clearInterval(timer);
    };
  }, [load]);
  return (
    <div className="finance-workspace finance-record-page">
      <Link className="finance-detail-link" href={back}>
        ← Back to financial records
      </Link>
      <div className="finance-topline">
        <div>
          <p className="finance-eyebrow">PAYMENTS & REFUNDS</p>
          <h1>
            {recordType === "recoveries"
              ? "Resolve paid order"
              : recordType === "payments"
                ? "Review payment & refund"
                : "Review money operation"}
          </h1>
          <p>
            Understand the result and choose the next step. Refund completion requires provider
            confirmation.
          </p>
        </div>
        {record &&
          (record.kind?.startsWith("REFUND") ? (
            <span className={`finance-badge ${refundState(record).tone}`}>
              {refundState(record).label}
            </span>
          ) : (
            <FinanceStatus value={record.status || record.deadline?.state || record.state} />
          ))}
      </div>
      {error && (
        <div role="alert" className="live-error">
          {error}
          <button
            className="secondary"
            onClick={() => void load().catch((e) => setError(userFacingError(e)))}
          >
            Try again
          </button>
        </div>
      )}
      {!record && !error && <p role="status">Loading payment review…</p>}
      {record && recordType === "recoveries" ? (
        <section className="finance-panel">
          <RecoveryReview
            item={record}
            manage={manage}
            refresh={load}
            orderLink={(id) =>
              `/admin/reconciliation/orders/${id}?returnTo=${encodeURIComponent(back)}`
            }
          />
        </section>
      ) : (
        record && (
          <>
            <div className="finance-record-layout">
              <div className="finance-record-main">
                <section className="finance-panel">
                  <div className="finance-record-heading">
                    <div>
                      <p className="finance-eyebrow">
                        {record.orderReference || "Account operation"}
                      </p>
                      <h2>{financeLabel(record.kind)}</h2>
                    </div>
                    <strong>
                      {money(recordType === "payments" ? record.paidMinor : record.amountMinor)}
                    </strong>
                  </div>
                  <div className="finance-review-summary">
                    {(recordType === "payments"
                      ? [
                          ["Verified principal", money(record.paidMinor)],
                          ["Produce", money(record.produceMinor)],
                          ["Delivery", money(record.shippingMinor)],
                          ["Processing fee", money(record.processingFeeMinor)],
                        ]
                      : [
                          ["Requested amount", money(record.amountMinor)],
                          ["Operation fee", money(record.feeMinor)],
                        ]
                    ).map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="finance-summary-caption">
                    {recordType === "payments"
                      ? "Verified principal is the confirmed collection. Refund eligibility and prior refunds are checked again by the backend before processing."
                      : "This amount belongs to the selected operation. Its current status determines whether any further action is needed."}
                  </p>
                </section>
                <section className="finance-panel">
                  <MoneyActions
                    key={`${recordType}:${recordId}`}
                    paymentId={recordType === "payments" ? recordId : undefined}
                    operationId={recordType === "operations" ? recordId : undefined}
                    manage={manage}
                    onUpdated={load}
                  />
                  {!manage && (
                    <p>
                      You have read-only access. A staff member with payment-management permission
                      must perform financial actions.
                    </p>
                  )}
                </section>
              </div>
              <aside className="finance-record-sidebar">
                <section className="finance-panel">
                  <h2>Order & payment context</h2>
                  <dl className="finance-facts">
                    {[
                      ["Order", record.orderReference || record.orderId || "Not linked"],
                      ["Created", financeDate(record.createdAt)],
                      ["Last updated", financeDate(record.updatedAt)],
                      ["Payment confirmed", financeDate(record.confirmedAt)],
                      [
                        "Issue",
                        financeLabel(record.failureCode || record.exceptionCode) ||
                          "No issue recorded",
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {record.orderId && (
                    <Link
                      className="finance-detail-link"
                      href={`/admin/reconciliation/orders/${record.orderId}?returnTo=${encodeURIComponent(back)}`}
                    >
                      Open complete order finance →
                    </Link>
                  )}
                </section>
                <section className="finance-panel">
                  <h2>What happens next?</h2>
                  <ol>
                    <li>Check the latest payment and refund status.</li>
                    <li>Choose the recommended action.</li>
                    <li>Review and authorize that specific action.</li>
                    <li>Wait for provider confirmation. Refreshing this page is safe.</li>
                  </ol>
                  <p>Status refreshes every 15 seconds while this page is visible.</p>
                </section>
                <details className="finance-panel">
                  <summary>Technical references</summary>
                  <dl className="finance-facts">
                    <div>
                      <dt>Record ID</dt>
                      <dd>{record.id}</dd>
                    </div>
                    <div>
                      <dt>Provider reference</dt>
                      <dd>{record.providerRef || record.chargeId || "Not yet available"}</dd>
                    </div>
                    <div>
                      <dt>Next provider check</dt>
                      <dd>{financeDate(record.nextRunAt)}</dd>
                    </div>
                  </dl>
                </details>
              </aside>
            </div>
          </>
        )
      )}
    </div>
  );
}
