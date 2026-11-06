"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { refundState } from "./refund-state";
import { usePathname, useSearchParams } from "next/navigation";
import { formatMoney as money } from "../../../../packages/contracts/src/money";
import { FinanceStatus, financeLabel, financeRequest as call } from "./finance-ui";
export function MoneyActions({
  orderId,
  operationId,
  paymentId,
  toolsOnly = false,
  onUpdated,
  manage = false,
}: {
  orderId?: string;
  operationId?: string;
  paymentId?: string;
  toolsOnly?: boolean;
  onUpdated?: () => Promise<void>;
  manage?: boolean;
}) {
  const pathname = usePathname(),
    params = useSearchParams();
  const [pending, setPending] = useState<{
    path: string;
    body: any;
    label: string;
    amountMinor?: string;
  } | null>(null);
  const authorization = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (pending) {
      authorization.current?.focus();
      authorization.current?.scrollIntoView?.({ behavior: "auto", block: "center" });
    }
  }, [pending]);
  const [providerReadiness, setProviderReadiness] = useState<any>(null);
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [code, setCode] = useState(""),
    [reason, setReason] = useState(""),
    [shipping, setShipping] = useState(""),
    [reference, setReference] = useState(""),
    [bankId, setBankId] = useState("");
  const readVersion = useRef(0),
    submitting = useRef(false);
  const load = useCallback(async () => {
    const version = ++readVersion.current;
    const value = await call(
      `money?${new URLSearchParams({ ...(orderId ? { orderId } : {}), ...(operationId ? { operationId } : {}), ...(paymentId ? { paymentId } : {}) })}`,
    );
    if (version === readVersion.current) setData(value);
  }, [orderId, operationId, paymentId]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "hidden")
        void load().catch((e) => {
          if (active) setError(e.message);
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
  const execute = async (path: string, body: any, step = true) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (step) {
        await call("auth/totp/step-up", { code });
        setCode("");
      }
      const result = await call(`money/${path}`, body);
      if (path.endsWith("/refund"))
        setNotice(
          result.status === "UNKNOWN"
            ? "Refund requested. We are checking its status automatically. No further approval is needed."
            : "Refund requested. Its status will update automatically after provider confirmation.",
        );
      if (path.endsWith("/retry-refund"))
        setNotice(
          "Original refund checked and queued or reconciled. No second refund operation was created.",
        );
      if (path.endsWith("/reconcile"))
        setNotice(
          "Reconciliation requested. Check the operation status below; this does not mean the refund is completed.",
        );
      if (path === "readiness") setProviderReadiness(result);
      if (step) {
        setPending(null);
        setReason("");
      }
      await load();
      await onUpdated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const action = async (path: string, body: any, step = true) => {
    if (busy) return;
    if (!step) return execute(path, body, false);
    const orderPayments = (data?.payments || []).filter((p: any) => p.status === "SUCCEEDED");
    const amountMinor = path.startsWith("payments/")
      ? data?.payments?.find((p: any) => p.id === path.split("/")[1])?.paidMinor
      : path.startsWith("orders/") && path.endsWith("/refund")
        ? (
            orderPayments.reduce((sum: bigint, p: any) => sum + BigInt(p.produceMinor || "0"), 0n) +
            (body.shippingRefundMinor === undefined
              ? orderPayments.reduce(
                  (sum: bigint, p: any) => sum + BigInt(p.shippingMinor || "0"),
                  0n,
                )
              : BigInt(body.shippingRefundMinor))
          ).toString()
        : data?.operations?.find((op: any) => op.id === path.split("/")[1])?.amountMinor;
    setPending({ path, body, label: actionLabel(path), amountMinor });
    setReason("");
    setCode("");
    setError("");
    setNotice("");
  };
  const operations =
    data?.operations?.filter(
      (op: any) =>
        (!orderId || op.orderId === orderId) &&
        (!operationId || op.id === operationId) &&
        (!paymentId || op.paymentId === paymentId),
    ) || [];
  if (!manage && !toolsOnly) return null;
  const ready = !busy;
  const canConfirm = !busy && reason.trim().length >= 10 && code.length === 6;
  const refunds = operations.filter(
    (op: any) => op.kind.startsWith("REFUND") && !["FAILED", "RESOLVED"].includes(op.status),
  );
  const exceptions = (data?.payments || []).filter(
    (p: any) =>
      (!orderId || p.orderId === orderId) &&
      (!paymentId || p.id === paymentId) &&
      !operationId &&
      p.status === "EXCEPTION",
  );
  const hasActions =
    operations.some(
      (op: any) =>
        ["REQUESTED", "BLOCKED", "UNKNOWN", "PROVIDER_PENDING"].includes(op.status) &&
        op.kind !== "DISPUTE" &&
        (!op.kind.startsWith("REFUND") || refundState(op).needsHelp),
    ) ||
    exceptions.some((p: any) => !refunds.some((op: any) => op.paymentId === p.id)) ||
    !!(orderId && !operationId && !paymentId);
  const refundHistory = operations.filter((op: any) => op.kind.startsWith("REFUND"));
  const currentRefund =
    refundHistory.find((op: any) => !["FAILED", "RESOLVED"].includes(op.status)) ||
    refundHistory[0];
  const visibleOperations = operationId ? operations : [
    ...(currentRefund ? [currentRefund] : []),
    ...operations.filter((op: any) => ["RELEASE", "PAYOUT"].includes(op.kind)),
  ];
  const history = operations.filter(
    (op: any) => !visibleOperations.some((v: any) => v.id === op.id),
  );
  return (
    <section className="finance-action-panel" aria-label="Payment review actions">
      <div className="finance-section-heading">
        <div>
          <h3>{toolsOnly ? "Provider tools" : orderId ? "Escrow release and refunds" : "Payment recovery"}</h3>
          <p>
            {toolsOnly
              ? "Check provider configuration and balances."
              : "Review release and refund attempts, resolve blocking issues, and track provider confirmation here."}
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Refresh status
        </button>
      </div>
      {notice && (
        <p role="status" className="finance-action-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading available actions…</p>}
      {data?.readiness?.workerStale && (
        <p role="alert" className="finance-action-notice">The payment worker has not completed a recent run. Check the worker service before expecting queued settlements to finish.</p>
      )}
      {toolsOnly ? (
        <>
          {data && (
            <p>
              {data.readiness.mode} · Collections {data.readiness.enabled ? "enabled" : "disabled"}{" "}
              · Webhook {data.readiness.webhookConfigured ? "configured" : "missing"}
            </p>
          )}
          <div className="finance-review-actions">
            <button disabled={busy} onClick={() => void action("reconcile", {}, false)}>
              Reconcile balances
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void action("readiness", {}, false)}
            >
              Check account readiness
            </button>
          </div>
          {providerReadiness && (
            <p role="status">
              Provider organization{" "}
              {providerReadiness.organizationMatches ? "verified" : "does not match configuration"}{" "}
              · Capabilities: {providerReadiness.capabilities.join(", ") || "none enabled"}
            </p>
          )}
        </>
      ) : (
        <>
          <aside className="finance-action-guide">
            <strong>Current refund position</strong>
            <p>
              {refunds.length
                ? "A refund already exists. Its latest status is shown below and updates automatically."
                : "Refund verified produce and eligible delivery payments. Processing fees are shown separately and may be non-returnable."}
            </p>
          </aside>
          {manage && pending && (
            <fieldset
              className="finance-security finance-confirm-action"
              ref={authorization}
              tabIndex={-1}
            >
              <legend>Review & authorize: {pending.label}</legend>
              <p>
                {pending.label}. Nothing has been submitted yet. Confirm the reason and enter your
                current authenticator code to proceed.
              </p>
              <p>
                {/\/refund$|retry-refund$/.test(pending.path)
                  ? "This requests refund processing; it does not mark the buyer refunded. Existing refunds and eligibility are checked again by the server."
                  : "This checks or updates the selected operation. Provider confirmation determines the final status."}
              </p>
              {pending.path.startsWith("orders/") &&
                pending.path.endsWith("/refund") &&
                pending.body.shippingRefundMinor === undefined && (
                  <p>
                    Refund includes all eligible produce and delivery principal. The server
                    calculates the exact amount and rejects ineligible shipments or prior refunds.
                  </p>
                )}
              {pending.body.shippingRefundMinor !== undefined && (
                <p>
                  <strong>
                    Delivery principal to refund: {money(pending.body.shippingRefundMinor || "0")}
                  </strong>
                </p>
              )}
              {pending.path.startsWith("payments/") && (
                <p>
                  <strong>
                    Verified principal:{" "}
                    {money(
                      data?.payments?.find((p: any) => p.id === pending.path.split("/")[1])
                        ?.paidMinor || "0",
                    )}
                  </strong>
                </p>
              )}
              {pending.body.destinationId && (
                <p>
                  Bank return destination: <strong>{pending.body.destinationId}</strong>. Confirm
                  this belongs to the original payer.
                </p>
              )}
              {pending.amountMinor && (
                <p>
                  <strong>Principal under review: {money(pending.amountMinor)}</strong>
                </p>
              )}
              <div className="finance-authorization-fields">
                <label>
                  Reason for this action
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={10}
                    maxLength={500}
                    placeholder="Explain what you checked and why this action is needed"
                  />
                </label>
                <label>
                  Authenticator code
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                  />
                </label>
              </div>
              <small>
                {busy
                  ? "Checking your request… Please wait."
                  : canConfirm
                    ? "Ready to submit this action."
                    : "Enter at least 10 characters and a six-digit code to continue."}
              </small>
              <div className="finance-review-actions">
                <button
                  disabled={!canConfirm}
                  onClick={() => void execute(pending.path, { ...pending.body, reason })}
                >
                  {busy ? "Submitting…" : pending.label}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setPending(null);
                    setReason("");
                    setCode("");
                  }}
                >
                  Cancel action
                </button>
              </div>
            </fieldset>
          )}
          <h4>{hasActions ? "Choose your next step" : "Current result"}</h4>
          {visibleOperations.map((op: any) => (
            <article className="finance-operation-card" key={op.id}>
              <div className="finance-section-heading">
                <strong>{financeLabel(op.kind)}</strong>
                {op.kind.startsWith("REFUND") ? (
                  <span className={`finance-badge ${refundState(op).tone}`}>
                    {refundState(op).label}
                  </span>
                ) : (
                  <FinanceStatus value={op.status} />
                )}
              </div>
              <dl className="finance-operation-facts">
                <div>
                  <dt>Amount</dt>
                  <dd>{money(op.amountMinor)}</dd>
                </div>
                <div>
                  <dt>Fee</dt>
                  <dd>{money(op.feeMinor)}</dd>
                </div>
              </dl>
              {op.failureCode && (!op.kind.startsWith("REFUND") || refundState(op).needsHelp) && (
                <p className="finance-action-notice">Issue: {financeLabel(op.failureCode)}</p>
              )}
              <p>{op.failureCode === "PROVIDER_WALLET_MISMATCH" || op.failureCode === "PROVIDER_BALANCE_LOW"
                ? operationGuidance(op) : op.kind.startsWith("REFUND") ? refundState(op).body : operationGuidance(op)}</p>
              {op.status === "FAILED" &&
                op.kind.startsWith("REFUND") &&
                operationId &&
                op.paymentId && (
                  <Link
                    className="finance-review-link"
                    href={`/admin/reconciliation/records/payments/${op.paymentId}?returnTo=${encodeURIComponent(`${pathname}${params.size ? `?${params}` : ""}`)}`}
                  >
                    Review payment before retrying →
                  </Link>
                )}
              {manage &&
                op.status !== "FAILED" &&
                (!op.kind.startsWith("REFUND") || refundState(op).needsHelp) && (
                  <details className="finance-operation-actions">
                    <summary>
                      {op.kind.startsWith("REFUND") ? "Resolve refund issue" : "Operation actions"}
                    </summary>
                    {op.status === "REQUESTED" && (
                      <div className="finance-review-actions">
                        <button
                          disabled={!ready}
                          onClick={() => void action(`operations/${op.id}/approve`, { reason })}
                        >
                          Approve withdrawal
                        </button>
                        <button
                          className="finance-danger-button"
                          disabled={!ready}
                          onClick={() => void action(`operations/${op.id}/reject`, { reason })}
                        >
                          Reject withdrawal
                        </button>
                      </div>
                    )}
                    {["BLOCKED", "UNKNOWN", "PROVIDER_PENDING"].includes(op.status) &&
                      op.kind !== "DISPUTE" && (
                        <button
                          disabled={!ready}
                          onClick={() => void action(`operations/${op.id}/reconcile`, { reason })}
                        >
                          {op.kind === "REFUND" && !op.providerRef
                            ? "Check original refund status"
                            : op.status === "BLOCKED" && !op.providerRef
                              ? "Resume original operation"
                              : "Check provider & reconcile"}
                        </button>
                      )}
                    {op.kind === "REFUND" && op.status === "UNKNOWN" && !op.providerRef && (
                      <details>
                        <summary>Refund still not found?</summary>
                        <p>
                          Use this only after checking the original refund. We check the provider
                          again and reuse the original request if it is absent. An outage will block
                          the retry.
                        </p>
                        <button
                          className="secondary"
                          disabled={!ready}
                          onClick={() =>
                            void action(`operations/${op.id}/retry-refund`, { reason })
                          }
                        >
                          Check provider and retry original refund
                        </button>
                      </details>
                    )}
                    {op.status === "UNKNOWN" && !op.providerRef && (
                      <details>
                        <summary>Link a known provider reference</summary>
                        <p>
                          Use only when the provider has supplied the original operation reference.
                          It must match this request.
                        </p>
                        <label>
                          Original provider reference
                          <input value={reference} onChange={(e) => setReference(e.target.value)} />
                        </label>
                        <button
                          className="secondary"
                          disabled={!ready || !reference}
                          onClick={() =>
                            void action(`operations/${op.id}/link`, {
                              reason,
                              providerRef: reference,
                            })
                          }
                        >
                          Verify and link original operation
                        </button>
                      </details>
                    )}
                    {op.kind === "REFUND_TRANSFER" && op.status === "BLOCKED" && (
                      <details>
                        <summary>Verify buyer bank return route</summary>
                        <p>
                          Confirm the bank destination belongs to the original payer using verified
                          evidence.
                        </p>
                        <label>
                          Verified original payer bank destination
                          <input value={bankId} onChange={(e) => setBankId(e.target.value)} />
                        </label>
                        <button
                          disabled={!ready || !bankId}
                          onClick={() =>
                            void action(`operations/${op.id}/refund-bank`, {
                              reason,
                              destinationId: bankId,
                              originalPayerVerified: true,
                            })
                          }
                        >
                          Confirm original payer and bank evidence
                        </button>
                      </details>
                    )}
                  </details>
                )}
            </article>
          ))}
          {exceptions.map((p: any) => {
            const existing = operations.some(
              (op: any) =>
                op.paymentId === p.id &&
                op.kind.startsWith("REFUND") &&
                !["FAILED", "RESOLVED"].includes(op.status),
            );
            if (existing) return null;
            return (
              <article className="finance-operation-card" key={p.id}>
                <h4>Payment available to refund</h4>
                <strong>{money(p.paidMinor || "0")}</strong>
                <p>Processing fee: {money(p.processingFeeMinor || "0")} (may be non-returnable)</p>
                <p>
                  {existing
                    ? "Track the existing refund above. No further approval is needed."
                    : "Review the verified amount above, then approve the refund once. The system handles submission and status checks."}
                </p>
                {!existing && manage && (
                  <>
                    {p.method?.toUpperCase().includes("TRANSFER") && (
                      <label>
                        Verified buyer bank return destination
                        <input value={bankId} onChange={(e) => setBankId(e.target.value)} />
                      </label>
                    )}
                    <button
                      className="finance-danger-button"
                      disabled={!ready}
                      onClick={() =>
                        void action(`payments/${p.id}/refund`, {
                          reason,
                          ...(bankId ? { destinationId: bankId } : {}),
                        })
                      }
                    >
                      Refund payment
                    </button>
                  </>
                )}
              </article>
            );
          })}
          {orderId && !operationId && !paymentId && (
            <>
              {data?.settlement && (
                <article className="finance-operation-card">
                  <h4>Escrow balance and release eligibility</h4>
                  {data.settlement.state && <p><strong>{financeLabel(data.settlement.state)}</strong></p>}
                  <p>Held in escrow: {money(data.settlement.heldMinor)}</p>
                  <p>Released: {money(data.settlement.releasedMinor)} · Refunded: {money(data.settlement.refundedMinor)}</p>
                  <p>{data.settlement.eligible ? "Eligible for release. Available provider funds are checked before transfer." : data.settlement.eligibilityReason}</p>
                </article>
              )}
              {!refunds.length && (
                <article className="finance-operation-card">
                  <h4>Refund this order</h4>
                  <strong>
                    {money(
                      (data?.payments || [])
                        .filter((p: any) => p.status === "SUCCEEDED")
                        .reduce(
                          (sum: bigint, p: any) =>
                            sum + BigInt(p.produceMinor || "0") + BigInt(p.shippingMinor || "0"),
                          0n,
                        )
                        .toString(),
                    )}
                  </strong>
                  <p>
                    Return the eligible produce and delivery principal. The system calculates the
                    amount and checks existing refunds before processing.
                  </p>
                  <details>
                    <summary>Adjust delivery refund or bank return route</summary>
                    <p>
                      Optional: use only for an agreed partial delivery refund or a bank-transfer
                      return. Leave blank to refund all eligible delivery principal.
                    </p>{" "}
                    <label>
                      Refundable delivery amount (kobo)
                      <input
                        inputMode="numeric"
                        placeholder="All eligible delivery principal"
                        value={shipping}
                        onChange={(e) => setShipping(e.target.value.replace(/\D/g, ""))}
                      />
                    </label>
                    {shipping !== "" && (
                      <small>Delivery refund override: {money(shipping)} · 100 kobo = ₦1</small>
                    )}
                    <label>
                      Buyer refund bank destination ID (bank transfers only)
                      <input value={bankId} onChange={(e) => setBankId(e.target.value)} />
                    </label>
                  </details>
                  <button
                    className="finance-danger-button"
                    disabled={!ready}
                    onClick={() =>
                      void action(`orders/${orderId}/refund`, {
                        reason,
                        ...(shipping !== "" ? { shippingRefundMinor: shipping } : {}),
                        ...(bankId ? { destinationId: bankId } : {}),
                      })
                    }
                  >
                    Refund order
                  </button>
                </article>
              )}
              <details className="finance-operation-card">
                <summary>Other financial actions</summary>
                <p>
                  These actions are separate from refunding a buyer. Release seller earnings only
                  after the required delivery and financial checks.
                </p>
                <div className="finance-review-actions">
                  <button
                    className="secondary"
                    disabled={!ready}
                    onClick={() => void action(`orders/${orderId}/release`, { reason })}
                  >
                    Approve seller release
                  </button>
                  <button
                    className="secondary"
                    disabled={!ready}
                    onClick={() => void action(`orders/${orderId}/resolve-hold`, { reason })}
                  >
                    Complete financial review
                  </button>
                </div>
              </details>
            </>
          )}
          {!!history.length && (
            <details className="finance-operation-card">
              <summary>Payment & operation history ({history.length})</summary>
              <p>
                Older attempts are kept for auditing. Open a record to review its own status and
                actions.
              </p>
              <div className="finance-history-list">
                {history.map((op: any) => (
                  <Link
                    key={op.id}
                    href={`/admin/reconciliation/records/operations/${op.id}?returnTo=${encodeURIComponent(`${pathname}${params.size ? `?${params}` : ""}`)}`}
                  >
                    <span>
                      {financeLabel(op.kind)} · {money(op.amountMinor)}
                    </span>
                    {op.kind.startsWith("REFUND") ? (
                      <span className={`finance-badge ${refundState(op).tone}`}>
                        {refundState(op).label}
                      </span>
                    ) : (
                      <FinanceStatus value={op.status} />
                    )}
                    <small>{op.id}</small>
                  </Link>
                ))}
              </div>
            </details>
          )}
          {data &&
            !operations.length &&
            !exceptions.length &&
            (!orderId || operationId || paymentId) && (
              <p>
                No refund action is available for this record. Open the complete order finance view
                to review eligibility.
              </p>
            )}
        </>
      )}
    </section>
  );
}
export function operationGuidance(op: {
  status: string;
  kind: string;
  providerRef?: string | null;
  failureCode?: string | null;
}) {
  if (op.failureCode === "PROVIDER_WALLET_MISMATCH")
    return "Bachs rejected the refund because the charge’s settlement account does not hold NGN. Ask the provider to correct the charge/wallet configuration before creating another refund. No refund was submitted.";
  if (op.failureCode === "PROVIDER_BALANCE_LOW")
    return "The provider’s available NGN balance cannot cover this payment. Confirm settlement or fund the sandbox balance, then resume this original operation. No transfer was submitted.";
  if (op.failureCode === "PAYMENT_BALANCE_UNAVAILABLE")
    return "The provider’s NGN balance could not be verified. Check the account currency configuration before resuming this operation.";
  if (op.status === "SUCCEEDED")
    return "Provider confirmation received. No further submission is needed.";
  if (["QUEUED", "PROCESSING", "PROVIDER_PENDING"].includes(op.status))
    return "This request is queued or processing. Wait for provider confirmation and refresh its status; do not submit a second request.";
  if (op.status === "UNKNOWN")
    return "The result is uncertain. First check the original operation with the provider. Do not create another refund.";
  if (op.status === "BLOCKED")
    return "Resolve the issue shown above, then reconcile this operation. Reconciliation does not override eligibility checks.";
  if (op.status === "FAILED")
    return "The provider rejected this request. Investigate the issue before requesting another refund from the payment or order record.";
  if (op.status === "REQUESTED")
    return "Review the withdrawal evidence, then approve or reject this request.";
  return "Review the record and its supporting evidence before proceeding.";
}

function actionLabel(path: string) {
  if (path.endsWith("/retry-refund")) return "Check and retry original refund";
  if (path.endsWith("/reconcile")) return "Check provider status";
  if (path.endsWith("/link")) return "Verify provider reference";
  if (path.endsWith("/refund-bank")) return "Confirm verified refund bank";
  if (path.endsWith("/refund")) return "Submit refund request";
  if (path.endsWith("/release")) return "Approve seller release";
  if (path.endsWith("/resolve-hold")) return "Complete financial review";
  if (path.endsWith("/approve")) return "Approve withdrawal";
  if (path.endsWith("/reject")) return "Reject withdrawal";
  return "Confirm action";
}
