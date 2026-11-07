"use client";
import { deliveryStatusCopy } from "../../../../packages/contracts/src/delivery-visibility";
import { OrderActionForm } from "./order-action-form";
import type { AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

const text = (form: FormData, name: string) => String(form.get(name) || "").trim();

export function DeliveryActions({ data, workflow }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow }) {
  const d = data.delivery;
  const commands = ["book", "refresh-quote", "manual-dispatch", "manual-status", "reconcile", "link", "link-parcel", "cancel-delivery", "assign-shipment", "legacy-status"] as const;
  if (!commands.some(command => workflow.available(command))) return null;
  return <section className="live-card" aria-label="Dispatch actions">
    <h2>Dispatch actions</h2>
    <div className="finance-action-panel">
      {workflow.available("reconcile") && <div><p className="finance-muted">Check for a new courier update. This does not buy a label, confirm receipt or release payment.</p><button className="secondary" disabled={workflow.disabled} onClick={() => void workflow.execute("reconcile")}>Refresh courier tracking</button></div>}
      {workflow.available("book") && <OrderActionForm label="Arrange courier pickup" description="Queue the paid delivery for booking. The existing payment, packing and booking checks still apply." command="book" workflow={workflow} payload={() => ({})} />}
      {workflow.available("refresh-quote") && <div><p className="finance-muted">Check the selected courier’s current price and availability before booking. Any price change must be reviewed.</p><button className="secondary" disabled={workflow.disabled || workflow.dirty} onClick={() => void workflow.execute("refresh-quote")}>Refresh delivery quote</button></div>}
      {workflow.available("manual-dispatch") && <OrderActionForm label="Assign manual dispatch" description="Record the agreed courier and tracking reference after confirming the delivery arrangement. This does not buy a courier label." command="manual-dispatch" workflow={workflow} reason payload={form => ({ carrier: text(form, "carrier"), trackingRef: text(form, "trackingRef") })}>
        <CourierFields />
      </OrderActionForm>}
      {workflow.available("assign-shipment") && <OrderActionForm label="Record manual shipment" description="For an earlier paid order without a delivery record: save the agreed courier and tracking reference. This does not book a courier." command="assign-shipment" workflow={workflow} payload={form => ({ carrier: text(form, "carrier"), trackingRef: text(form, "trackingRef") })}>
        <CourierFields />
      </OrderActionForm>}
      {workflow.available("manual-status") && <OrderActionForm label="Update manual delivery" description="Record only a confirmed shipment update and its supporting evidence. A delivery update does not confirm buyer receipt or release payment." command="manual-status" workflow={workflow} payload={form => ({ status: text(form, "status"), evidence: text(form, "evidence") })}>
        <label>New delivery status<select name="status">{data.staffContext.manualDeliveryStatuses.map(status => <option key={status} value={status}>{deliveryStatusCopy(status).label}</option>)}</select></label>
        <label>Delivery evidence<textarea name="evidence" required minLength={10} maxLength={500} /></label>
      </OrderActionForm>}
      {workflow.available("legacy-status") && <OrderActionForm label="Update earlier shipment" description="This earlier workflow records staff delivery confirmation, not a new buyer acknowledgment. Confirm only a verified shipment update." command="legacy-status" workflow={workflow} payload={form => ({ status: text(form, "status"), evidence: text(form, "evidence") })}>
        <label>New shipment status<select name="status"><option value={data.legacyShipment!.status === "ASSIGNED" ? "IN_TRANSIT" : "DELIVERED"}>{data.legacyShipment!.status === "ASSIGNED" ? "In transit" : "Delivered"}</option></select></label>
        <label>Delivery evidence<textarea name="evidence" required minLength={5} maxLength={500} /></label>
      </OrderActionForm>}
      {workflow.available("link") && <OrderActionForm label="Link existing courier booking" description="Find and verify the booking already made with the courier. Match its route, price and shipment reference; do not book or pay again." command="link" workflow={workflow} sensitive reason payload={form => ({ providerShipmentId: text(form, "providerShipmentId") })}>
        <label>Verified courier shipment reference<input name="providerShipmentId" required minLength={3} maxLength={160} /></label>
      </OrderActionForm>}
      {workflow.available("link-parcel") && d?.parcels.filter(parcel => !parcel.providerShipmentId && ["BOOKING", "BOOKING_UNCERTAIN"].includes(parcel.status)).map(parcel =>
        <OrderActionForm key={parcel.id} label={`Link package ${parcel.parcelIndex + 1} booking`} description="Verify and link the courier’s existing booking for this package. Do not buy another label." command="link-parcel" workflow={workflow} sensitive reason payload={form => ({ parcelId: parcel.id, providerShipmentId: text(form, "providerShipmentId") })}>
          <label>Verified courier shipment reference<input name="providerShipmentId" required minLength={3} maxLength={160} /></label>
        </OrderActionForm>,
      )}
      {workflow.available("cancel-delivery") && <OrderActionForm label="Request delivery cancellation" description="Send a cancellation request for the existing booking. Wait for the courier’s confirmation; this does not cancel the order or issue a refund." command="cancel-delivery" workflow={workflow} sensitive reason danger payload={() => ({})} />}
    </div>
  </section>;
}

function CourierFields() {
  return <><label>Confirmed courier<input name="carrier" required minLength={2} maxLength={120} /></label><label>Tracking reference<input name="trackingRef" required minLength={2} maxLength={120} /></label></>;
}
