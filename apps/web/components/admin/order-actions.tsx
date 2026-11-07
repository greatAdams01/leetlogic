"use client";
import { useState } from "react";
import { formatMoney } from "../../../../packages/contracts/src/money";
import { OrderActionForm } from "./order-action-form";
import type { AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

export function OrderPaymentActions({ data, workflow }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow }) {
  return <div className="finance-action-panel">
    {workflow.available("escrow") && <ManualEscrow data={data} workflow={workflow} />}
    {workflow.available("delivery-payment") && <OrderActionForm label="Record delivery payment" description="Use only a verified payment received outside the payment provider. The amount must match the selected delivery quote." command="delivery-payment" workflow={workflow} sensitive payload={form => ({ amountMinor: data.delivery!.shippingMinor, reference: String(form.get("reference") || "").trim() })}>
      <p>Delivery amount: <strong>{formatMoney(data.delivery!.shippingMinor)}</strong></p>
      <label>Verified payment reference<input name="reference" minLength={3} maxLength={160} required /></label>
    </OrderActionForm>}
  </div>;
}

function ManualEscrow({ data, workflow }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow }) {
  const choices = data.staffContext.manualEscrowKinds;
  const [selection, setSelection] = useState(choices[0]);
  const kind = choices.includes(selection) ? selection : choices[0];
  const amount = kind === "FUND" ? data.order.totalMinor : data.money.heldMinor;
  return <OrderActionForm label="Manage manually recorded funds" description="These controls record funds held or settled outside the payment provider. The full order amount is required for funding; settlement uses the full held balance. Every action is checked and audited." command="escrow" workflow={workflow} sensitive reason payload={form => ({
    kind, amountMinor: amount,
    ...(String(form.get("externalRef") || "").trim() ? { externalRef: String(form.get("externalRef")).trim() } : {}),
  })}>
    <label>Payment action<select name="kind" value={kind} onChange={event => setSelection(event.target.value)}>
      {choices.map(value => <option key={value} value={value}>{({ FUND: "Record produce payment", RELEASE: "Release funds to farmer", REFUND: "Refund held funds" } as Record<string, string>)[value]}</option>)}
    </select></label>
    <p>Amount: <strong>{formatMoney(amount)}</strong></p>
    <label>{kind === "FUND" ? "Verified payment reference" : "Payment reference (optional)"}<input name="externalRef" required={kind === "FUND"} minLength={3} maxLength={160} /></label>
  </OrderActionForm>;
}

export function CancelOrderAction({ workflow }: { workflow: OrderRecordWorkflow }) {
  if (!workflow.available("cancel-order")) return null;
  return <div className="finance-action-panel"><OrderActionForm label="Cancel unpaid order" description="Cancel only if the order should not proceed. No paid funds will be refunded by this action." command="cancel-order" workflow={workflow} reason danger payload={() => ({})} /></div>;
}
