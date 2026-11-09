"use client";
import { historyChanges } from "../../../../packages/contracts/src/admin-order-history";
import { nigeriaStateNames } from "../../../../packages/contracts/src/addresses";
import { OrderActionForm } from "./order-action-form";
import type { AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

const text = (form: FormData, name: string) => String(form.get(name) || "").trim();
const changed = (before: unknown, after: unknown) => historyChanges(before, after).length > 0;

export function OrderCorrections({ data, workflow }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow }) {
  if (!workflow.available("correct-order")) return null;
  const contact = data.staffContext.buyerContact || { ...data.staffContext.buyer, email: "" };
  return <section className="live-card" aria-label="Order corrections">
    <h2>Correct order information</h2>
    <p className="finance-muted">Correct this order’s contact snapshot or fulfillment notes, not the buyer’s account. Produce, quantities, prices, payment and receipt confirmation remain in their existing workflows.</p>
    <OrderActionForm label="Edit order information" description="Enter verified corrections, explain why, then compare the original and proposed values before saving." command="correct-order" workflow={workflow} payload={(form, baseline) => {
      const buyerContact = { name: text(form, "buyer.name"), phone: text(form, "buyer.phone"), email: text(form, "buyer.email") };
      const fulfillmentNotes = text(form, "fulfillmentNotes") || null;
      return { changes: {
        ...(changed(baseline.staffContext.buyerContact, buyerContact) ? { buyerContact } : {}),
        ...(baseline.staffContext.fulfillmentNotes !== fulfillmentNotes ? { fulfillmentNotes } : {}),
      } };
    }}>
      <label>Order contact name<input name="buyer.name" defaultValue={contact.name} required minLength={2} maxLength={120} /></label>
      <label>Order contact phone<input name="buyer.phone" type="tel" defaultValue={contact.phone} required pattern="\+?[0-9]{10,15}" /></label>
      <label>Order contact email (optional)<input name="buyer.email" type="email" defaultValue={contact.email} maxLength={254} /></label>
      <label>Fulfillment notes<textarea name="fulfillmentNotes" defaultValue={data.staffContext.fulfillmentNotes || ""} maxLength={700} /></label>
    </OrderActionForm>
  </section>;
}

export function DeliveryCorrections({ data, workflow }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow }) {
  const d = data.delivery, s = data.manualShipment, allowed = data.staffContext.corrections;
  if (!workflow.available("correct-delivery")) return null;
  return <section className="live-card" aria-label="Delivery corrections">
    <h2>Correct delivery information</h2>
    <p className="finance-muted">Every correction needs a reason and a before/after review. Local edits do not update the logistics provider.</p>
    {allowed.providerControlled && <p className="finance-callout">The courier controls this booked route and rider. Confirm address or rider changes with the provider; use verified tracking, reconciliation or cancellation here. A local override is not supported.</p>}
    {d && <OrderActionForm label="Edit delivery notes" description="Save internal operational notes. These do not change the booked route, dispatch status or any payment." command="correct-delivery" workflow={workflow} payload={form => ({ changes: { operationsNotes: text(form, "operationsNotes") || null } })}>
      <label>Delivery notes<textarea name="operationsNotes" defaultValue={d.operationsNotes || ""} maxLength={700} /></label>
    </OrderActionForm>}
    {d && !allowed.providerControlled && <>
      {!allowed.destination && <p className="finance-muted">Drop-off corrections are locked after payment or dispatch, or while checkout, financial review or settlement is active.</p>}
      <OrderActionForm label="Correct drop-off details" description="Use a verified full address. A different street clears the old saved-address reference and map pin. A payable courier quote must be replaced." command="correct-delivery" workflow={workflow} blocked={!allowed.destination} payload={form => ({ changes: { destination: {
        name: text(form, "destination.name"), phone: text(form, "destination.phone"), email: text(form, "destination.email"),
        address: text(form, "destination.address"), state: text(form, "destination.state"), country: "NG",
        ...(text(form, "destination.postalCode") ? { postalCode: text(form, "destination.postalCode") } : {}),
        instructions: text(form, "destination.instructions"),
      } } })}>
        <label>Drop-off contact name<input name="destination.name" defaultValue={d.destination?.name || ""} required minLength={2} maxLength={120} /></label>
        <label>Drop-off phone<input name="destination.phone" type="tel" defaultValue={d.destination?.phone || ""} required pattern="\+?[0-9]{10,15}" /></label>
        <label>Drop-off email (optional)<input name="destination.email" type="email" defaultValue={d.destination?.email || ""} maxLength={254} /></label>
        <label>Full drop-off address<textarea name="destination.address" defaultValue={d.destination?.address || ""} required minLength={15} maxLength={500} /></label>
        <label>Drop-off state<select name="destination.state" defaultValue={d.destination?.state || ""} required><option value="">Select state</option>{nigeriaStateNames.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
        <label>Digital postcode (optional)<input name="destination.postalCode" defaultValue={d.destination?.postalCode || ""} maxLength={40} /></label>
        <label>Additional directions<textarea name="destination.instructions" defaultValue={d.destination?.instructions || ""} maxLength={700} /></label>
      </OrderActionForm>
    </>}
    {s && !allowed.providerControlled && <>
      {!allowed.riderAssignment && <p className="finance-muted">Manual rider reassignment is locked after receipt, settlement or cancellation, and during financial review.</p>}
      <OrderActionForm label="Reassign manual rider" description="Record a rider change only after the manual courier has agreed. This changes the internal assignment, not a provider booking, courier status or receipt confirmation." command="correct-delivery" workflow={workflow} blocked={!allowed.riderAssignment} payload={form => ({ changes: { riderAssignment: {
        name: text(form, "rider.name"), phone: text(form, "rider.phone"), reference: text(form, "rider.reference"),
      } }, arrangementConfirmed: form.get("arrangementConfirmed") === "on" })}>
        <label>Confirmed rider name<input name="rider.name" defaultValue={s.riderAssignment?.name || ""} required minLength={2} maxLength={120} /></label>
        <label>Confirmed rider phone<input name="rider.phone" type="tel" defaultValue={s.riderAssignment?.phone || ""} required pattern="\+?[0-9]{10,15}" /></label>
        <label>Courier assignment reference<input name="rider.reference" defaultValue={s.riderAssignment?.reference || ""} required minLength={3} maxLength={120} /></label>
        <label className="operations-check"><input name="arrangementConfirmed" type="checkbox" required />The manual courier confirmed this rider assignment.</label>
      </OrderActionForm>
    </>}
  </section>;
}
