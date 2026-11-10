"use client";
import { useEffect, useRef, useState } from "react";
import { historyChanges, type OrderHistoryEntry, type OrderHistoryPage } from "../../../../packages/contracts/src/admin-order-history";
import { deliveryEventLabel } from "../../../../packages/contracts/src/delivery-visibility";
import { userFacingError } from "../../lib/user-facing-error";
import { financeRequest } from "./finance-ui";
import { ChangeComparison, historyDate } from "./order-history-ui";

const actions: Record<string, string> = {
  "order.admin.investigation.opened": "Investigation opened — funds held", "order.admin.investigation.migrated": "Held case corrected to an open investigation", "ADMIN_INVESTIGATION": "Case under investigation — funds held",
  "order.admin.resolved": "Order resolved by administrator", "ADMIN_RESOLVED": "Order and delivery resolved by administrator",
  "order.information.corrected": "Order information corrected", "delivery.information.corrected": "Delivery information corrected",
  "order.created": "Order placed", "order.insert": "Order placed", "order.cancelled": "Unpaid order cancelled", "order.customer.cancelled": "Buyer cancelled unpaid order",
  "order.farmer.accepted": "Farmer accepted the order", "order.farmer.rejected": "Farmer declined the order", "order.buyer.handover": "Farmer handed goods to buyer",
  "shipment.assigned": "Manual shipment assigned", "shipment.status.changed": "Earlier manual shipment updated", "delivery.manual.assigned": "Manual dispatch assigned", "delivery.manual.status": "Manual delivery updated",
  "delivery.tracking.refresh.requested": "Courier tracking refresh requested", "delivery.cancel.requested": "Courier cancellation requested", "delivery.booking.requested": "Courier booking queued",
  "delivery.quoted": "Courier quotes received", "delivery.quote.requested": "Delivery details saved for quotation", "delivery.quote.invalidated": "Previous quote retired after an invalid request",
  "delivery.quote.refresh.requested": "Courier quote refresh requested", "delivery.quote.refreshed": "Courier quote refreshed", "delivery.selected": "Courier quote selected",
  "delivery.linked": "Existing courier booking verified and linked", "delivery.parcel.linked": "Existing package booking verified and linked", "delivery.payment.confirmed": "Manual delivery payment recorded",
  "escrow.fund": "Produce payment recorded", "escrow.release": "Farmer payment recorded", "escrow.refund": "Refund recorded", "delivery.recipient.confirmed": "Buyer confirmed receipt",
  "order.receipt.photo.saved": "Buyer saved receipt evidence", "payment.hold.resolved": "Financial review completed", "history.baseline": "Original record preserved at history checkpoint",
};
const subjects: Record<string, string> = { order: "Order", delivery: "Delivery", shipment: "Shipment", deliveryParcel: "Package", deliveryQuote: "Courier quote", payment: "Payment", money_operation: "Payment operation", moneyOperation: "Payment operation", escrow: "Escrow record", support_ticket: "Support", compliance: "Compliance" };
const sources: Record<string, string> = { admin: "Administrator", buyer: "Buyer", farmer: "Farmer", customer: "User", courier: "Logistics provider", system: "Automated system" };
function activityLabel(entry: OrderHistoryEntry) {
  if (actions[entry.action]) return actions[entry.action];
  if (entry.kind === "EVENT") return deliveryEventLabel(entry.action);
  return `${subjects[entry.entityType] || "Related record"} ${entry.kind === "INSERT" ? "created" : entry.kind === "DELETE" ? "removed" : "updated"}`;
}

export function OrderRecordHistory({ orderId, initial, sectionId }: { orderId: string; initial: OrderHistoryPage; sectionId: string }) {
  const [page, setPage] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const scope = useRef(0), active = useRef(false), loading = useRef(false);
  useEffect(() => {
    scope.current++; active.current = true; loading.current = false;
    setPage(initial); setBusy(false); setError("");
    return () => { active.current = false; scope.current++; };
  }, [orderId, initial.through]); // A new committed history window replaces, not mixes, paginated snapshots.
  async function earlier() {
    if (loading.current || !page.nextCursor) return;
    const version = scope.current;
    loading.current = true; setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ cursor: page.nextCursor, through: page.through });
      const next: OrderHistoryPage = await financeRequest(`orders/${orderId}/history?${query}`);
      if (!active.current || version !== scope.current) return;
      if (!Array.isArray(next.items) || next.through !== page.through || next.items.some(item => item.orderId !== orderId)) throw Error("This history page could not be verified. Refresh the record.");
      setPage(current => ({ ...next, items: [...next.items, ...current.items] }));
    } catch (failure) { if (active.current && version === scope.current) setError(userFacingError(failure)); }
    finally { if (active.current && version === scope.current) { loading.current = false; setBusy(false); } }
  }
  return <section className="live-card" id={sectionId} aria-label="Activity History">
    <h2>Activity History</h2>
    <p className="finance-muted">Oldest to newest within the displayed history. Original values and successful changes are preserved; this history cannot be edited or deleted here.</p>
    {page.completeFrom && <p className="finance-callout">Complete record snapshots start {historyDate(page.completeFrom)} (WAT). Earlier recorded actions were imported, but values that were never recorded before that date cannot be recovered.</p>}
    {page.hasMore && <button className="secondary" disabled={busy} onClick={() => void earlier()}>{busy ? "Loading earlier activity…" : "Load earlier activity"}</button>}
    {error && <p className="live-error" role="alert">{error} The displayed history has been kept.</p>}
    {!page.items.length && <p className="finance-muted">No activity has been recorded yet.</p>}
    <ol className="verification-history operations-history">{page.items.map(entry => {
      const changes = historyChanges(entry.before, entry.after);
      return <li key={entry.id}>
        <div><strong>{activityLabel(entry)}</strong><span className="finance-badge neutral">{subjects[entry.entityType] || "Related record"}</span><time dateTime={entry.occurredAt} title={entry.occurredAt}>{historyDate(entry.occurredAt)} (WAT)</time></div>
        <p className="finance-muted">{sources[entry.actorType] || "Recorded source"} · {entry.actorName}{entry.actorId && <span className="operations-actor-id" title={entry.actorId}> · ID {entry.actorId}</span>}</p>
        <p className="verification-prose">{entry.reason ? `Reason: ${entry.reason}` : entry.actorType === "admin" ? "Reason not recorded." : "Operational or lifecycle update."}</p>
        {entry.kind === "LEGACY_ACTION" && <p className="finance-muted">Earlier audit entry — only the information recorded at the time is available.</p>}
        {!!changes.length && <details><summary>{entry.kind === "BASELINE" || entry.kind === "INSERT" ? "View saved information" : `Compare values (${changes.length})`}</summary><ChangeComparison changes={changes} /></details>}
      </li>;
    })}</ol>
  </section>;
}
