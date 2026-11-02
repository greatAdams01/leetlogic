"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney as money } from "../../../../packages/contracts/src/money";
import { financeRequest as call } from "./finance-ui";
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
  const [providerReadiness, setProviderReadiness] = useState<any>(null);
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [reason, setReason] = useState(""),
    [shipping, setShipping] = useState("0"),
    [reference, setReference] = useState(""),
    [bankId, setBankId] = useState("");
  const load = useCallback(
    async () =>
      setData(
        await call(
          `money?${new URLSearchParams({ ...(orderId ? { orderId } : {}), ...(operationId ? { operationId } : {}), ...(paymentId ? { paymentId } : {}) })}`,
        ),
      ),
    [orderId, operationId, paymentId],
  );
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  const action = async (path: string, body: any, step = true) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (step) {
        await call("auth/totp/step-up", { code });
        setCode("");
      }
      const result = await call(`money/${path}`, body);
      if (path === "readiness") setProviderReadiness(result);
      await load();
      await onUpdated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const operations =
    data?.operations?.filter(
      (op: any) => (!orderId || op.orderId === orderId) && (!operationId || op.id === operationId),
    ) || [];
  if (!manage && !toolsOnly) return null;
  return (
    <section className="finance-action-panel">
      <h3>Review and actions</h3>
      <button disabled={busy} onClick={() => void load().catch((e) => setError(e.message))}>
        Refresh payment records
      </button>
      {toolsOnly && data && (
        <p>
          {data.readiness.mode} · Collections {data.readiness.enabled ? "enabled" : "disabled"} ·
          Webhook {data.readiness.webhookConfigured ? "configured" : "missing"}
        </p>
      )}
      {providerReadiness && (
        <p role="status">
          Provider organization{" "}
          {providerReadiness.organizationMatches ? "verified" : "does not match configuration"} ·
          Capabilities: {providerReadiness.capabilities.join(", ") || "none enabled"}
        </p>
      )}
      {manage && (
        <>
          {!toolsOnly && (
            <>
              <label>
                Authenticator code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>
              <label>
                Reason
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={10}
                  maxLength={500}
                />
              </label>
              {orderId && !operationId && !paymentId && (
                <>
                  <button
                    disabled={busy || reason.length < 10 || code.length !== 6}
                    onClick={() => void action(`orders/${orderId}/release`, { reason })}
                  >
                    Approve seller release
                  </button>
                  <button
                    disabled={busy || reason.length < 10 || code.length !== 6}
                    onClick={() => void action(`orders/${orderId}/resolve-hold`, { reason })}
                  >
                    Complete financial review
                  </button>
                  <label>
                    Refundable delivery amount (kobo)
                    <input
                      inputMode="numeric"
                      value={shipping}
                      onChange={(e) => setShipping(e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <label>
                    Buyer refund bank destination ID (bank transfers only)
                    <input value={bankId} onChange={(e) => setBankId(e.target.value)} />
                  </label>
                  <button
                    disabled={busy || reason.length < 10 || code.length !== 6}
                    onClick={() =>
                      void action(`orders/${orderId}/refund`, {
                        reason,
                        shippingRefundMinor: shipping,
                        ...(bankId ? { destinationId: bankId } : {}),
                      })
                    }
                  >
                    Request refund
                  </button>
                </>
              )}
            </>
          )}
          {toolsOnly && (
            <>
              <button disabled={busy} onClick={() => void action("reconcile", {}, false)}>
                Reconcile balances
              </button>
              <button disabled={busy} onClick={() => void action("readiness", {}, false)}>
                Check account readiness
              </button>
            </>
          )}
        </>
      )}
      {!toolsOnly && !!operationId && !!operations.length && (
        <table>
          <thead>
            <tr>
              <th>Operation</th>
              <th>Amount / fee</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op: any) => (
              <tr key={op.id}>
                <td>
                  {op.kind}
                  <br />
                  <small>{op.id}</small>
                </td>
                <td>
                  {money(op.amountMinor)} / {money(op.feeMinor)}
                </td>
                <td>
                  {op.status}
                  <br />
                  {op.failureCode}
                </td>
                <td>
                  {manage && op.status === "REQUESTED" && (
                    <>
                      <button
                        disabled={busy || code.length !== 6 || reason.length < 10}
                        onClick={() => void action(`operations/${op.id}/approve`, { reason })}
                      >
                        Approve withdrawal
                      </button>
                      <button
                        disabled={busy || code.length !== 6 || reason.length < 10}
                        onClick={() => void action(`operations/${op.id}/reject`, { reason })}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {manage &&
                    ["BLOCKED", "UNKNOWN", "PROVIDER_PENDING"].includes(op.status) &&
                    op.kind !== "DISPUTE" && (
                      <button
                        disabled={busy || code.length !== 6 || reason.length < 10}
                        onClick={() => void action(`operations/${op.id}/reconcile`, { reason })}
                      >
                        Reconcile operation
                      </button>
                    )}
                  {manage && op.status === "UNKNOWN" && !op.providerRef && (
                    <>
                      <input
                        aria-label="Original provider reference"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                      <button
                        disabled={busy || !reference || code.length !== 6 || reason.length < 10}
                        onClick={() =>
                          void action(`operations/${op.id}/link`, {
                            reason,
                            providerRef: reference,
                          })
                        }
                      >
                        Verify and link original operation
                      </button>
                    </>
                  )}
                  {manage && op.kind === "REFUND_TRANSFER" && op.status === "BLOCKED" && (
                    <>
                      <input
                        aria-label="Verified original payer bank destination"
                        value={bankId}
                        onChange={(e) => setBankId(e.target.value)}
                      />
                      <button
                        disabled={busy || !bankId || code.length !== 6 || reason.length < 10}
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
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!toolsOnly &&
        data?.payments
          ?.filter(
            (p: any) =>
              (!orderId || p.orderId === orderId) &&
              (!paymentId || p.id === paymentId) &&
              !operationId &&
              p.status === "EXCEPTION",
          )
          .map((p: any) => (
            <p key={p.id}>
              Payment requires reconciliation: {p.id} · {p.exceptionCode}
              {manage && (
                <button
                  disabled={busy || reason.length < 10 || code.length !== 6}
                  onClick={() =>
                    void action(`payments/${p.id}/refund`, {
                      reason,
                      ...(bankId ? { destinationId: bankId } : {}),
                    })
                  }
                >
                  Refund unallocated payment
                </button>
              )}
            </p>
          ))}
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
    </section>
  );
}
