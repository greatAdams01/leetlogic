"use client";
import { useState } from "react";
import { resolutionFinancialLabels, type AdminOrderResolution } from "../../../../packages/contracts/src/order-resolution";
import { formatMoney } from "../../../../packages/contracts/src/money";
import { OrderActionForm } from "./order-action-form";
import { OrderFacts, orderStatusLabel, adminOrderStatusLabel } from "./order-ui";
import { financeDate } from "./finance-ui";
import type { AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

type FinancialAction = AdminOrderResolution["financialAction"];
export function OrderResolution({ data, workflow, onClose }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow; onClose: () => void }) {
  const options = data.staffContext.resolutionOptions;
  const [outcome, setOutcome] = useState("");
  const financialAction: FinancialAction = outcome === "UNDER_INVESTIGATION" || !outcome ? "HOLD" : options.none ? "NONE" : outcome === "COMPLETED" ? "RELEASE" : "REFUND";
  return <section className="live-card operations-resolution" aria-label="Resolve Order">
    <div className="finance-section-heading"><div><h2>Resolve Order</h2><p className="finance-muted">Complete with payment release, cancel with a refund, or keep the case open for investigation.</p></div><button className="secondary" disabled={workflow.pending} onClick={onClose}>Back to details</button></div>
    <OrderFacts items={[["Order status", orderStatusLabel(data.order.status)], ["Delivery", data.tracking?.label || "Not arranged"], ["Payment status", data.staffContext.manualFundingRecorded ? "Manually recorded payment" : data.money.progress.title], ["Funds held", formatMoney(data.money.heldMinor)], ["Already released", formatMoney(data.money.releasedMinor)], ["Already refunded", formatMoney(data.money.refundedMinor)]]} />
    <OrderActionForm inline sensitive onSaved={onClose} label="Confirm order resolution" command="resolve" workflow={workflow}
      description="Choose one decision. Its payment action follows automatically. Explain your decision and evidence, then review everything before confirming with your authenticator."
      payload={form => ({ outcome: String(form.get("outcome")), financialAction: String(form.get("financialAction")), evidence: String(form.get("evidence") || "").trim(),
        shippingRefundMinor: String(form.get("shippingRefundMinor") || "0"),
        ...(String(form.get("destinationId") || "").trim() ? { destinationId: String(form.get("destinationId")).trim() } : {}),
        confirmed: form.get("confirmed") === "on" })}>
      <label>Resolution decision<select name="outcome" required value={outcome} onChange={event => setOutcome(event.target.value)}>
        <option value="">Select a decision</option>
        <option value="COMPLETED" disabled={!options.release && !options.none}>{options.none ? "Complete order — no payment to move" : "Complete order and release payment to farmer"}</option>
        <option value="CANCELLED" disabled={!options.refund && !options.none}>{options.none ? "Cancel order — no payment to move" : "Cancel order and refund buyer"}</option>
        <option value="UNDER_INVESTIGATION">Keep case open under investigation — hold funds</option>
      </select></label>
      <input type="hidden" name="financialAction" value={financialAction} />
      {outcome && <p><strong>Payment action:</strong> {resolutionFinancialLabels[financialAction]}</p>}
      {options.blockedReason && <p className="finance-callout">{options.blockedReason}</p>}
      {financialAction === "REFUND" && (options.refundableShippingMinor !== "0" || options.resumeShippingRefundMinor) && <label>Delivery fee refund<select name="shippingRefundMinor" defaultValue={options.resumeShippingRefundMinor || "0"}>{options.resumeShippingRefundMinor != null ? <option value={options.resumeShippingRefundMinor}>Resume recorded delivery refund ({formatMoney(options.resumeShippingRefundMinor)})</option> : <><option value="0">Refund produce only</option><option value={options.refundableShippingMinor}>Also refund unspent delivery funds ({formatMoney(options.refundableShippingMinor)})</option></>}</select></label>}
      {financialAction === "REFUND" && options.bankRefundRequired && <label>Buyer’s approved refund account<select name="destinationId" required defaultValue={options.resumeDestinationId || ""}><option value="">Select the original payer’s account</option>{options.refundDestinations.filter(bank => !options.resumeDestinationId || bank.id === options.resumeDestinationId).map(bank => <option value={bank.id} key={bank.id}>{bank.bankName} · {bank.accountName} · ending {bank.accountLastFour}</option>)}</select></label>}
      {financialAction === "HOLD" && <p className="finance-callout">The order remains open as Under investigation. Existing delivery tracking is preserved, and remaining funds stay in escrow. Your admin team must investigate and return here to complete with release or cancel with refund. Transfers already submitted may still complete.</p>}
      {(financialAction === "RELEASE" || financialAction === "REFUND") && <p className="finance-callout">{data.staffContext.fundsProvider === "bachs" ? "A payment instruction will be queued. The provider must confirm it before it is shown as paid or refunded. Open disputes and uncertain transactions must be reconciled first." : "This settles the manually recorded produce escrow. It records the internal settlement; it does not send a bank transfer or refund a courier fee."}</p>}
      <label>Evidence supporting this decision<textarea name="evidence" required minLength={10} maxLength={500} placeholder="For example: verified buyer confirmation, courier correspondence, or dispute investigation findings." /></label>
      <label className="operations-check"><input name="confirmed" type="checkbox" required />{outcome === "UNDER_INVESTIGATION" ? "I confirm the case will remain open under investigation, with no new payout or refund." : "I confirm this final decision. Closing the local delivery does not cancel or change the courier’s booking."}</label>
    </OrderActionForm>
  </section>;
}

export function ResolutionSummary({ data }: { data: AdminOrderRecord }) {
  const resolution = data.staffContext.adminResolution;
  if (!resolution) return null;
  if (resolution.financialAction === "HOLD") return <aside className="finance-callout" role="status"><strong>Under investigation · case remains open · {financeDate(resolution.resolvedAt)}</strong><p>{resolution.reason}</p><p>Funds held: {formatMoney(data.money.heldMinor)}. Investigate the case, then return to Resolve Order to complete with release or cancel with refund. Courier tracking remains available.</p></aside>;
  return <aside className="finance-callout" role="status"><strong>{resolution.outcome === "COMPLETED" ? adminOrderStatusLabel(data) : "Cancelled"} · {financeDate(resolution.resolvedAt)}</strong>
    <p>{resolution.reason}</p><p>{resolutionFinancialLabels[resolution.financialAction]}. Current funds held: {formatMoney(data.money.heldMinor)}.</p>
    <p>Courier booking unchanged. Closure is an administrative decision, not a courier delivery report or a new buyer receipt confirmation. Activity History contains the decision and any confirmed financial results.</p>
  </aside>;
}
