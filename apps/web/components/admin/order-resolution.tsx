"use client";
import { useState } from "react";
import { resolutionFinancialLabels, type AdminOrderResolution } from "../../../../packages/contracts/src/order-resolution";
import { formatMoney } from "../../../../packages/contracts/src/money";
import { OrderActionForm } from "./order-action-form";
import { OrderFacts, orderStatusLabel } from "./order-ui";
import { financeDate } from "./finance-ui";
import type { AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

type FinancialAction = AdminOrderResolution["financialAction"];
export function OrderResolution({ data, workflow, onClose }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow; onClose: () => void }) {
  const options = data.staffContext.resolutionOptions;
  const [outcome, setOutcome] = useState("");
  const [payment, setPayment] = useState<FinancialAction>(options.none ? "NONE" : "HOLD");
  const available = (action: FinancialAction) => action === "RELEASE" ? outcome === "COMPLETED" && options.release : action === "REFUND" ? outcome === "CANCELLED" && options.refund : action === "NONE" ? options.none : options.hold;
  const financialAction = available(payment) ? payment : options.none ? "NONE" : "HOLD";
  return <section className="live-card operations-resolution" aria-label="Resolve Order">
    <div className="finance-section-heading"><div><h2>Resolve Order</h2><p className="finance-muted">Close this order and its local delivery record when normal fulfillment cannot finish.</p></div><button className="secondary" disabled={workflow.pending} onClick={onClose}>Back to details</button></div>
    <OrderFacts items={[["Order status", orderStatusLabel(data.order.status)], ["Delivery", data.tracking?.label || "Not arranged"], ["Payment status", data.staffContext.manualFundingRecorded ? "Manually recorded payment" : data.money.progress.title], ["Funds held", formatMoney(data.money.heldMinor)], ["Already released", formatMoney(data.money.releasedMinor)], ["Already refunded", formatMoney(data.money.refundedMinor)]]} />
    <OrderActionForm inline sensitive onSaved={onClose} label="Confirm order resolution" command="resolve" workflow={workflow}
      description="Choose the operational outcome and the financial instruction. Explain your decision and evidence, then review everything before confirming with your authenticator."
      payload={form => ({ outcome: String(form.get("outcome")), financialAction: String(form.get("financialAction")), evidence: String(form.get("evidence") || "").trim(),
        shippingRefundMinor: String(form.get("shippingRefundMinor") || "0"),
        ...(String(form.get("destinationId") || "").trim() ? { destinationId: String(form.get("destinationId")).trim() } : {}),
        confirmed: form.get("confirmed") === "on" })}>
      <div className="operations-grid">
        <label>Close order as<select name="outcome" required value={outcome} onChange={event => setOutcome(event.target.value)}><option value="">Select completed or cancelled</option><option value="COMPLETED">Completed — fulfilled</option><option value="CANCELLED">Cancelled — not fulfilled</option></select></label>
        <label>Payment outcome<select name="financialAction" value={financialAction} onChange={event => setPayment(event.target.value as FinancialAction)}>
          {(Object.keys(resolutionFinancialLabels) as FinancialAction[]).map(action => <option key={action} value={action} disabled={!available(action)}>{resolutionFinancialLabels[action]}</option>)}
        </select></label>
      </div>
      {options.blockedReason && <p className="finance-callout">{options.blockedReason}</p>}
      {financialAction === "REFUND" && (options.refundableShippingMinor !== "0" || options.resumeShippingRefundMinor) && <label>Delivery fee refund<select name="shippingRefundMinor" defaultValue={options.resumeShippingRefundMinor || "0"}>{options.resumeShippingRefundMinor != null ? <option value={options.resumeShippingRefundMinor}>Resume recorded delivery refund ({formatMoney(options.resumeShippingRefundMinor)})</option> : <><option value="0">Refund produce only</option><option value={options.refundableShippingMinor}>Also refund unspent delivery funds ({formatMoney(options.refundableShippingMinor)})</option></>}</select></label>}
      {financialAction === "REFUND" && options.bankRefundRequired && <label>Buyer’s approved refund account<select name="destinationId" required defaultValue={options.resumeDestinationId || ""}><option value="">Select the original payer’s account</option>{options.refundDestinations.filter(bank => !options.resumeDestinationId || bank.id === options.resumeDestinationId).map(bank => <option value={bank.id} key={bank.id}>{bank.bankName} · {bank.accountName} · ending {bank.accountLastFour}</option>)}</select></label>}
      {financialAction === "HOLD" && <p className="finance-callout">Remaining funds stay on hold. This does not reverse completed payments or stop a transfer already submitted to the payment provider. Return to Resolve Order after the investigation to decide the remaining balance.</p>}
      {(financialAction === "RELEASE" || financialAction === "REFUND") && <p className="finance-callout">{data.staffContext.fundsProvider === "bachs" ? "A payment instruction will be queued. The provider must confirm it before it is shown as paid or refunded. Open disputes and uncertain transactions must be reconciled first." : "This settles the manually recorded produce escrow. It records the internal settlement; it does not send a bank transfer or refund a courier fee."}</p>}
      <label>Evidence supporting this decision<textarea name="evidence" required minLength={10} maxLength={500} placeholder="For example: verified buyer confirmation, courier correspondence, or dispute investigation findings." /></label>
      <label className="operations-check"><input name="confirmed" type="checkbox" required />I confirm this decision and understand that closing the local delivery does not cancel or change the courier’s booking.</label>
    </OrderActionForm>
  </section>;
}

export function ResolutionSummary({ data }: { data: AdminOrderRecord }) {
  const resolution = data.staffContext.adminResolution;
  if (!resolution) return null;
  return <aside className="finance-callout" role="status"><strong>{resolution.outcome === "COMPLETED" ? "Completed" : "Cancelled"} by administrator · {financeDate(resolution.resolvedAt)}</strong>
    <p>{resolution.reason}</p><p>{resolutionFinancialLabels[resolution.financialAction]}. Current funds held: {formatMoney(data.money.heldMinor)}.</p>
    <p>Courier booking unchanged. Closure is an administrative decision, not a courier delivery report or a new buyer receipt confirmation. Activity History contains the decision and any confirmed financial results.</p>
  </aside>;
}
