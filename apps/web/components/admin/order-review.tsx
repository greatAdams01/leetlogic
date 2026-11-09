"use client";
import { OrderResolution, ResolutionSummary } from "./order-resolution";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { OrderActionWorkspace } from "./order-action-form";
import { useSearchParams } from "next/navigation";
import { type DeliveryVisibilityEvent } from "../../../../packages/contracts/src/delivery-visibility";
import { formatMoney } from "../../../../packages/contracts/src/money";
import { adminRecordReturnPath, operationsDetailLink, operationsReturnQueue, type OperationsArea } from "../../lib/admin-order-navigation";
import { DeliveryTracking } from "../delivery-tracking";
import { DeliveryActions } from "./delivery-actions";
import { DeliverySetup } from "./delivery-setup";
import { financeDate, financeLabel } from "./finance-ui";
import { CancelOrderAction, OrderPaymentActions } from "./order-actions";
import { DeliveryCorrections, OrderCorrections } from "./order-corrections";
import { OrderRecordHistory } from "./order-record-history";
import { adminFulfillmentLabel, adminNextStep, farmerDecisionLabel, OperationsBadge, OrderFacts, orderStatusLabel } from "./order-ui";
import type { AdminOrderRecord } from "./order-types";
import { useOrderRecord, type OrderRecordWorkflow } from "./use-order-record";
import type { Contact } from "../../../mobile/src/lib/domain";

export function OrderReview({ id, area, permissions, onChanged }: { id: string; area: OperationsArea; permissions: readonly string[]; onChanged?: () => void }) {
  const params = useSearchParams();
  const [resolutionView, setResolutionView] = useState<string | null>(null);
  const [resolutionLoaded, setResolutionLoaded] = useState<string | null>(null);
  const workflow = useOrderRecord(id, permissions, onChanged), data = workflow.record;
  const back = adminRecordReturnPath(params.get("returnTo"), `/admin/${area}`);
  // Keep cross-links one level deep instead of nesting return links on every visit.
  const queueBack = operationsReturnQueue(back, area);
  const current = operationsDetailLink(area, id, queueBack);
  const dispatch = area === "logistics";
  if (!permissions.includes("orders.read")) return <section className="live-card"><p role="alert">You do not have permission to view {dispatch ? "deliveries" : "orders"}.</p></section>;
  return <div className="operations-record-page">
    <div className="finance-topline"><Link href={back} className="finance-back">← Back to {back.startsWith("/admin/logistics/") ? "delivery" : back.startsWith("/admin/orders/") ? "order" : back.startsWith("/admin/logistics") ? "Deliveries" : back.startsWith("/admin/orders") ? "Orders" : "previous workspace"}</Link><button className="secondary" disabled={workflow.loading || workflow.pending} onClick={() => void workflow.load()}>Refresh details</button></div>
    {workflow.loadError && <p className="live-error" role="alert">{workflow.loadError}{data ? ` Showing the last update from ${financeDate(data.observedAt)} (WAT). Actions are paused until details refresh.` : ""}</p>}
    {workflow.actionError && <p className="live-error" role="alert">{workflow.actionError}</p>}
    {workflow.notice && <p className="live-notice" role="status">{workflow.notice}</p>}
    {!data && !workflow.loadError && <section className="live-card"><p role="status">Loading {dispatch ? "delivery" : "order"} details…</p></section>}
    {data && <>
      <section className="live-card operations-record-summary">
        <div className="finance-section-heading"><div><h2>{data.order.reference}</h2><p>{data.order.title} · {data.order.quantity} {data.order.unitCode}</p></div>
          <div className="operations-summary-actions">{workflow.available("resolve") && <button disabled={workflow.disabled} onClick={() => { setResolutionLoaded(id); setResolutionView(id); }}>Resolve Order</button>}<OperationsBadge value={dispatch ? data.tracking?.status || data.order.status : data.order.status} label={dispatch ? data.tracking?.label || (data.progress.method === "Pickup" ? "Buyer collection" : "Not arranged") : orderStatusLabel(data.order.status)} />
          {(dispatch || data.progress.method !== "Pickup") && <Link className="finance-review-link" href={operationsDetailLink(dispatch ? "orders" : "logistics", id, current)}>{dispatch ? "View related order" : "View delivery details"} →</Link>}</div>
        </div>
        <p className="finance-muted">{adminNextStep(data)}</p>
      </section>
      <ResolutionSummary data={data} />
      <OrderReviewIssues data={data} permissions={permissions} />
      {workflow.available("resolve") && resolutionLoaded === id && <div hidden={resolutionView !== id}><OrderResolution key={id} data={data} workflow={workflow} onClose={() => setResolutionView(null)} /></div>}
      <div hidden={resolutionView === id && workflow.available("resolve")}>
      {dispatch ? <DeliveryRecord data={data} current={current} workflow={workflow} /> : <OrderRecord data={data} current={current} permissions={permissions} workflow={workflow} />}
      </div>
      <p className="dispatch-observed">Updated {financeDate(data.observedAt)} (WAT). Details refresh every 30 seconds while this page is visible.</p>
    </>}
  </div>;
}

function OrderRecord({ data, current, permissions, workflow }: { data: AdminOrderRecord; current: string; permissions: readonly string[]; workflow: OrderRecordWorkflow }) {
  const receiptSource = data.tracking?.receiptSource === "legacy-staff";
  const events = data.delivery?.events || [];
  return <>
    <RecordSections recordKey={data.order.id} area="order" sections={["Overview", "Manage order", "Payment", "Activity"]}>
    <div className="operations-section-stack">
    <div className="operations-grid" id="order-overview">
      <section className="live-card"><h2>Order & produce</h2><OrderFacts items={[["Produce", data.order.title], ["Quantity", `${data.order.quantity} ${data.order.unitCode}`], ["Produce total", formatMoney(data.order.totalMinor)], ["Order placed", financeDate(data.staffContext.createdAt)]]} />
        {data.order.description && <p className="verification-prose">{data.order.description}</p>}

      </section>
      <section className="live-card"><h2>Buyer & farmer</h2><OrderFacts items={[["Buyer", data.staffContext.buyer.name], ["Buyer phone", <Phone key="buyer" value={data.staffContext.buyer.phone} />], ["Farmer", data.staffContext.farmer.name], ["Farm", data.staffContext.farmer.farmName], ["Farmer phone", <Phone key="farmer" value={data.staffContext.farmer.phone} />]]} />
        <h3>Order contact</h3><OrderFacts items={[["Order contact", data.staffContext.buyerContact?.name || "Not recorded"], ["Order contact phone", data.staffContext.buyerContact?.phone ? <Phone value={data.staffContext.buyerContact.phone} /> : "Not recorded"], ["Order contact email", data.staffContext.buyerContact?.email || "Not recorded"]]} />
      </section>
    </div>
    <section className="live-card" id="order-fulfillment"><div className="finance-section-heading"><h2>Fulfillment</h2><OperationsBadge value={data.order.farmerDecision} label={farmerDecisionLabel(data.order.farmerDecision)} /></div>
      <p className="finance-muted">{adminFulfillmentLabel(data)}</p>
      <h3>Fulfillment notes</h3><p className="verification-prose">{data.staffContext.fulfillmentNotes || "No fulfillment notes recorded."}</p>
      <OrderFacts items={[["Method", data.progress.method === "Pickup" ? "Buyer collection" : "Courier delivery"], ["Farmer response", data.staffContext.farmerDecidedAt ? financeDate(data.staffContext.farmerDecidedAt) : "Not recorded yet"], ["Produce ready", eventDate(events, "READY_FOR_PICKUP")], [data.progress.method === "Pickup" ? "Handed to buyer" : "Handed to courier", data.order.handedOverAt ? financeDate(data.order.handedOverAt) : eventDate(events, "FARMER_DISPATCHED")], [receiptSource ? "Earlier staff receipt confirmation" : "Buyer receipt confirmation", data.order.deliveryConfirmedAt ? financeDate(data.order.deliveryConfirmedAt) : "Not confirmed"], ["Delivery", data.tracking?.label || (data.progress.method === "Pickup" ? "Buyer collection" : "Not arranged")]]} />
      {data.order.rejectionReason && <p>Farmer’s reason: {data.order.rejectionReason}</p>}
      <p className="finance-muted">{receiptSource ? "The earlier staff confirmation is not a new buyer acknowledgment." : "Courier delivery updates do not confirm buyer receipt or release funds."}</p>
      {data.order.receiptPhoto && <a className="finance-detail-link" href={`/api/admin/delivery-orders/${data.order.id}/delivery/receipt-photo`} target="_blank" rel="noopener noreferrer">View receipt photo</a>}
      {data.progress.method === "Pickup" && <ContactRecord label="Collection location" contact={data.order.suggestedPickup} />}
      {data.tracking && <Link className="finance-review-link" href={operationsDetailLink("logistics", data.order.id, current)}>Open dispatch & tracking →</Link>}
    </section>
    </div>
    <OrderActionWorkspace enabled={workflow.available("correct-order")}><OrderCorrections data={data} workflow={workflow} /><CancelOrderAction workflow={workflow} /></OrderActionWorkspace>
    <section className="live-card" id="order-payment" aria-label="Order payment">
      <div className="finance-section-heading"><h2>Payment summary</h2>{permissions.includes("payments.read") && <Link className="finance-review-link" href={`/admin/reconciliation/orders/${data.order.id}?returnTo=${encodeURIComponent(current)}`}>Review payments →</Link>}</div>
      <div className="operations-grid"><div><OrderFacts items={[["Produce", formatMoney(data.order.totalMinor)], ["Delivery fee", data.delivery?.selectedQuoteId || data.progress.method === "Pickup" ? formatMoney(data.delivery?.shippingMinor || "0") : "Not quoted"], ["Recorded order total", data.order.totalWithDeliveryMinor ? formatMoney(data.order.totalWithDeliveryMinor) : "Not available yet"]]} /></div>
        <div><h3>{manualPaymentTitle(data)}</h3><p className="finance-muted">{data.staffContext.manualFundingRecorded ? "Manually recorded funds are not a verified payment-provider transaction." : data.money.progress.body}</p>
          <OrderFacts items={[["Produce funds held", formatMoney(data.money.heldMinor)], ["Produce funds released", formatMoney(data.money.releasedMinor)], ["Refund recorded", formatMoney(data.money.refundedMinor)], ["Farmer payout", data.staffContext.manualFundingRecorded ? BigInt(data.money.releasedMinor) > 0n ? "Manual settlement recorded" : "Not recorded" : data.money.progress.transfer]]} />
        </div>
      </div>
      {(workflow.available("escrow") || workflow.available("delivery-payment")) && <OrderActionWorkspace><OrderPaymentActions data={data} workflow={workflow} /></OrderActionWorkspace>}
    </section>
    <OrderRecordHistory orderId={data.order.id} initial={data.staffContext.activity} sectionId="order-activity" />
    </RecordSections>
  </>;
}

function DeliveryRecord({ data, current, workflow }: { data: AdminOrderRecord; current: string; workflow: OrderRecordWorkflow }) {
  const d = data.delivery;
  return <RecordSections recordKey={data.order.id} area="delivery" sections={["Overview", "Manage delivery", "Route & packages", "Activity"]}>
    <div className="operations-section-stack">
    {!data.tracking && <section className="live-card"><h2>{data.progress.method === "Pickup" ? "Buyer collection, not courier delivery" : "No courier delivery arranged"}</h2><p className="finance-muted">{data.progress.method === "Pickup" ? "Pickup readiness and receipt confirmation are managed in the order." : "Confirm the delivery arrangement before assigning a courier. Existing booking and payment checks still apply."}</p></section>}
    {d?.operationsNotes && <section className="live-card"><h2>Delivery notes</h2><p className="verification-prose">{d.operationsNotes}</p></section>}
    {data.manualShipment && <section className="live-card"><h2>Manual rider assignment</h2>
      {data.manualShipment.riderAssignment ? <OrderFacts items={[["Rider", data.manualShipment.riderAssignment.name], ["Rider phone", <Phone value={data.manualShipment.riderAssignment.phone} />], ["Assignment reference", data.manualShipment.riderAssignment.reference]]} /> : <p className="finance-muted">No confirmed manual rider recorded.</p>}
      <p className="finance-muted">Confirmed with the manual courier; not a provider-side booking update.</p>
    </section>}
    {d?.cancelRequestedAt && <p className="finance-callout danger" role="status">Cancellation requested {financeDate(d.cancelRequestedAt)}. Wait for courier confirmation; no refund is implied. Do not repeat the request.</p>}
    {data.tracking && <DeliveryTracking tracking={data.tracking} staff showGuidance={false} hideTimeline />}
    {data.legacyShipment && <section className="live-card"><h2>Earlier manual shipment</h2><OrderFacts items={[["Courier", data.legacyShipment.carrier], ["Tracking reference", data.legacyShipment.trackingRef], ["Last updated", financeDate(data.legacyShipment.updatedAt)]]} /><p className="verification-prose">{data.legacyShipment.evidence || "No shipment evidence recorded."}</p><p className="finance-muted">This earlier workflow records staff confirmation, not a new buyer receipt acknowledgment.</p></section>}
    </div>
    <OrderActionWorkspace enabled={(["correct-delivery", "book", "refresh-quote", "manual-dispatch", "manual-status", "reconcile", "link", "link-parcel", "cancel-delivery", "assign-shipment", "legacy-status", "quotes", "select"] as const).some(command => workflow.available(command))}><DeliveryActions data={data} workflow={workflow} /><DeliverySetup data={data} workflow={workflow} /><DeliveryCorrections data={data} workflow={workflow} /></OrderActionWorkspace>
    <div className="operations-section-stack">
    <div className="operations-grid">
      <section className="live-card"><h2>Pickup</h2><ContactRecord label="Pickup contact" contact={d?.pickup || data.order.suggestedPickup} /><OrderFacts items={[["Pickup date", d?.package?.pickupDate || "Not scheduled"], ["Farmer handoff", eventDate(d?.events || [], "FARMER_DISPATCHED")]]} /></section>
      <section className="live-card"><h2>Drop-off</h2><ContactRecord label="Drop-off contact" contact={d?.destination || null} /></section>
    </div>
    {d && <section className="live-card"><h2>Packages & delivery fee</h2><OrderFacts items={[["Packages", data.tracking?.packageCount || data.order.packageSuggestion?.packageCount || 1], ["Delivery fee", d.selectedQuoteId ? formatMoney(d.shippingMinor) : "Not quoted"], ["Delivery payment recorded", formatMoney(d.paidMinor)]]} />
      <Link className="finance-detail-link" href={`${operationsDetailLink("orders", data.order.id, current)}#order-payment`}>View order payments →</Link>
      {d.package && <div className="operations-packing"><h3>Packing & pickup instructions</h3><OrderFacts items={[["Weight per package", d.package.weightKg ? `${d.package.weightKg} kg` : "Not recorded"], ["Dimensions", d.package.length && d.package.width && d.package.height ? `${d.package.length} × ${d.package.width} × ${d.package.height} cm` : "Not recorded"], ["Handling", financeLabel(d.package.handling) || "Not recorded"]]} /><p className="verification-prose">{[d.package.notes, d.package.pickupInstructions].filter(Boolean).join(" · ") || "No additional packing instructions."}</p></div>}
    </section>}
    </div>
    <OrderRecordHistory orderId={data.order.id} initial={data.staffContext.activity} sectionId="delivery-activity" />
  </RecordSections>;
}

function OrderReviewIssues({ data, permissions }: { data: AdminOrderRecord; permissions: readonly string[] }) {
  return <>
    {data.staffContext.financialHold && <aside className="finance-callout danger" role="status"><strong>Order under financial review</strong><p>Fulfillment and payment settlement are paused until the review is resolved.</p></aside>}
    {data.staffContext.disputes.map(dispute => <aside key={dispute.id} className="finance-callout danger"><strong>Open dispute: {dispute.subject}</strong><p>{financeLabel(dispute.status)}{permissions.includes("disputes.manage") && <> · <Link href={`/admin/disputes?id=${dispute.id}`}>Review dispute →</Link></>}</p></aside>)}
    {data.fulfillment && !["SECURED", "REFUNDED", "ADMIN_RESOLVED"].includes(data.fulfillment.state) && <aside className={`finance-callout ${data.fulfillment.state !== "ACTIVE" || new Date(data.fulfillment.refundDueAt).getTime() <= Date.now() ? "danger" : ""}`}><strong>Fulfillment deadline</strong><p>{financeLabel(data.fulfillment.state)} · {financeDate(data.fulfillment.refundDueAt)} (WAT). The existing refund deadline has not changed.</p></aside>}
  </>;
}

function ContactRecord({ contact, label }: { contact: Contact | null; label: string }) {
  if (!contact) return <p className="finance-muted">No {label.toLowerCase()} recorded.</p>;
  return <div aria-label={label}><OrderFacts items={[["Contact", contact.name || "Not recorded"], ["Phone", contact.phone ? <Phone value={contact.phone} /> : "Not recorded"], ["Address", [contact.address, contact.state].filter(Boolean).join(", ") || "Not recorded"]]} />{contact.instructions && <p className="verification-prose">Directions: {contact.instructions}</p>}</div>;
}

function Phone({ value }: { value: string }) { return <a href={`tel:${value.replace(/[^+\d]/g, "")}`}>{value}</a>; }

function manualPaymentTitle(data: AdminOrderRecord) {
  if (!data.staffContext.manualFundingRecorded) return data.money.progress.title;
  return BigInt(data.money.refundedMinor) > 0n ? "Manual refund recorded" : BigInt(data.money.releasedMinor) > 0n ? "Manual settlement recorded" : "Manually recorded payment";
}

function eventDate(events: DeliveryVisibilityEvent[], status: string) {
  const event = events.find(event => event.status === status);
  return event ? financeDate(new Date(event.createdAt).toISOString()) : "Not recorded yet";
}

function RecordSections({ recordKey, area, sections, children }: { recordKey: string; area: string; sections: string[]; children: ReactNode[] }) {
  const [selection, setSelection] = useState({ recordKey, index: 0 });
  const selected = selection.recordKey === recordKey ? selection.index : 0;
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash;
      const index = hash.includes("payment") ? sections.indexOf("Payment") : hash.includes("activity") ? sections.indexOf("Activity") : hash.includes("manage") ? 1 : hash.includes("route") ? sections.indexOf("Route & packages") : 0;
      setSelection({ recordKey, index: Math.max(0, index) });
    };
    fromHash(); window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [recordKey, area]);
  function select(index: number) {
    setSelection({ recordKey, index });
    const slug = sections[index] === "Payment" ? "payment" : sections[index] === "Activity" ? "activity" : index === 1 ? "manage" : sections[index] === "Route & packages" ? "route" : "overview";
    window.history.replaceState(window.history.state, "", `#${area}-${slug}`);
  }
  return <div className="operations-sections">
    <div className="finance-tabs operations-section-tabs" role="tablist" aria-label={`${area === "order" ? "Order" : "Delivery"} sections`}>
      {sections.map((name, index) => <button key={name} id={`${area}-tab-${index}`} role="tab" aria-selected={selected === index} aria-controls={`${area}-panel-${index}`} tabIndex={selected === index ? 0 : -1} onClick={() => select(index)} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % sections.length : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length : event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : null;
        if (next !== null) { event.preventDefault(); select(next); document.getElementById(`${area}-tab-${next}`)?.focus(); }
      }}>{name}</button>)}
    </div>
    {children.map((child, index) => <div key={`${recordKey}:${index}`} id={`${area}-panel-${index}`} role="tabpanel" aria-labelledby={`${area}-tab-${index}`} hidden={selected !== index} tabIndex={0}>{child}</div>)}
  </div>;
}
