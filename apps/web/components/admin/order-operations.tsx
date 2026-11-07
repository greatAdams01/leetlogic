"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { deliveryActiveStates, deliveryPendingStates, deliveryStatusCopy, safeTrackingUrl } from "../../../../packages/contracts/src/delivery-visibility";
import { formatMoney } from "../../../../packages/contracts/src/money";
import { CustomerDelivery } from "../customer-delivery";
import { financeDate, financeLabel, financeRequest } from "./finance-ui";
import { userFacingError } from "../../lib/user-facing-error";

type QueueOrder = {
  id: string; reference: string; status: string; createdAt: string;
  listing: { title: string; unitCode: string }; quantity: string; totalMinor: string;
  buyer: { name: string; phone: string };
  farmer: { name: string; farmName: string; decision: string; decidedAt: string | null };
  fulfillment: { status: string; method: string; readyAt: string | null; dispatchedAt: string | null; receiptConfirmedAt: string | null; receiptSource: string };
  payment: { title: string; source: string; heldMinor: string; releasedMinor: string; refundedMinor: string; transfer: string };
  delivery: null | {
    id: string; status: string; label: string; courier: string | null; provider: string | null;
    providerShipmentId: string | null; trackingRef: string | null; legacyTrackingRef: string | null;
    pickupState: string | null; destinationState: string | null;
    packageCount: number; deliveredPackages: number; lastSyncedAt: string | null; lastProgressAt: string | null;
    assignments: { providerShipmentId: string | null; parcelIndex?: number; status: string; trackingUrl: string | null; courier: { name: string | null; phone: string | null }; rider: { name: string | null; phone: string | null } | null }[];
  };
  issues: { code: string; title: string; body: string }[];
};
type QueueData = { items: QueueOrder[]; total: number; page: number; pageSize: number; observedAt: string; counts: { pending: number; active: number; attention: number; delivered: number } };
const views = [
  ["ALL", "All records"], ["ATTENTION", "Needs attention"], ["PENDING", "Pending booking"],
  ["ACTIVE", "Dispatch in progress"], ["DELIVERED", "Delivery reported"], ["FAILED", "Failed / returned / cancelled"],
  ["DELAYED", "Possible delay"], ["STALE", "Stale tracking"],
] as const;

export function OrderOperations({ dispatch = false, permissions }: { dispatch?: boolean; permissions: string[] }) {
  const router = useRouter(), params = useSearchParams(), base = dispatch ? "logistics" : "orders";
  const query = params.get("search") || "", status = params.get("status") || "ALL", farmer = params.get("farmer") || "ALL", view = params.get("view") || "ALL";
  const page = Math.min(10000, Math.max(1, Number(params.get("page")) || 1));
  const selected = params.get("id"), orderId = selected && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(selected) ? selected : null;
  const path = `${dispatch ? "dispatch" : "order-operations"}?${new URLSearchParams({ page: String(page), search: query, status, farmer, view })}`;
  const [search, setSearch] = useState(query), [snapshot, setSnapshot] = useState<{ path: string; data: QueueData }>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), requests = useRef(0), loading = useRef(false);
  const data = snapshot?.path === path ? snapshot.data : undefined;
  useEffect(() => setSearch(query), [query]);
  const filters = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) value === null ? next.delete(key) : next.set(key, value);
    router.push(`/admin/${base}?${next}`, { scroll: false });
  };
  const load = useCallback(async () => {
    const version = ++requests.current;
    loading.current = true;
    setBusy(true);
    try {
      const next = await financeRequest(path) as QueueData;
      if (version !== requests.current) return;
      setSnapshot({ path, data: next });
      setError("");
    } catch (failure) {
      if (version === requests.current) setError(userFacingError(failure));
    } finally {
      if (version === requests.current) { loading.current = false; setBusy(false); }
    }
  }, [path]);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!loading.current && document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      requests.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => { if (orderId) detail.current?.focus({ preventScroll: true }); }, [orderId]);
  const statuses = dispatch ? [...new Set([...deliveryPendingStates, ...deliveryActiveStates, "DELIVERED", "RETURNED", "CANCELLED"])]
    : ["AWAITING_PAYMENT", "FUNDED", "DELIVERED", "COMPLETED", "REFUNDED", "CANCELLED"];
  return <div className="dispatch-workspace">
    <div className="dispatch-toolbar">
      <p>Updates refresh every 30 seconds while this page is visible. Provider tracking is not a live rider location.</p>
      <button className="secondary" disabled={busy} onClick={() => void load()}>Refresh records</button>
      <Link href={`/admin/${base}?legacy=1`}>Legacy {dispatch ? "shipment controls" : "order controls"}</Link>
    </div>
    <div className="dispatch-metrics" aria-label="Order and dispatch counts">
      {([['pending', 'Pending booking', 'PENDING'], ['active', 'Dispatch in progress', 'ACTIVE'], ['attention', 'Needs attention', 'ATTENTION'], ['delivered', 'Delivery reported', 'DELIVERED']] as const).map(([key, label, value]) =>
        <button key={key} className={`dispatch-metric ${view === value ? "selected" : ""}`} onClick={() => filters({ view: value, page: "1" })}>
          <span>{label}</span><strong>{data?.counts[key] ?? "—"}</strong>
        </button>)}
    </div>
    <section className="live-card">
      <form className="dispatch-filters" onSubmit={event => { event.preventDefault(); filters({ search, page: "1" }); }}>
        <label>Search orders or shipments<input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Reference, buyer, farmer, courier or shipment ID" /></label>
        <label>Operational view<select value={view} onChange={event => filters({ view: event.target.value, page: "1" })}>{views.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{dispatch ? "Delivery status" : "Order status"}<select value={status} onChange={event => filters({ status: event.target.value, page: "1" })}>
          <option value="ALL">All statuses</option>{statuses.map(value => <option key={value} value={value}>{dispatch ? deliveryStatusCopy(value).label : financeLabel(value)}</option>)}
        </select></label>
        <label>Farmer confirmation<select value={farmer} onChange={event => filters({ farmer: event.target.value, page: "1" })}>
          <option value="ALL">All decisions</option>{["PENDING", "ACCEPTED", "REJECTED", "LEGACY"].map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}
        </select></label>
        <button className="secondary">Search</button>
      </form>
      {error && <p className="live-error" role="alert">{error}{data ? ` Showing the snapshot from ${financeDate(data.observedAt)}.` : ""}</p>}
      {!data && busy && <p role="status">Loading order and delivery progress…</p>}
      {data && <>
        <p className="dispatch-observed">Snapshot loaded {financeDate(data.observedAt)} (West Africa Time). Delay flags are investigation prompts, not guaranteed delivery deadlines.</p>
        <div className="live-table-wrap">
          <table className="dispatch-queue">
            <thead><tr><th>Order / parties</th><th>{dispatch ? "Booking / courier" : "Payment"}</th><th>Farmer / fulfillment</th><th>{dispatch ? "Rider / packages" : "Delivery"}</th><th>Latest updates</th><th>Needs attention</th><th>Review</th></tr></thead>
            <tbody>{data.items.map(order => <tr key={order.id} className={order.id === orderId ? "selected" : undefined}>
              <td><strong>{order.reference}</strong><small>{order.listing.title} · {order.quantity} {order.listing.unitCode}</small><small>Buyer: {order.buyer.name}</small><small>Farmer: {order.farmer.farmName}</small><small>{financeLabel(order.status)} · {financeDate(order.createdAt)}</small></td>
              <td>{dispatch ? <>
                <strong>{order.delivery?.label || "No delivery arrangement"}</strong><small>{order.delivery?.courier || "Courier not confirmed"}</small><small>{order.delivery?.provider}</small>
                <small>{[order.delivery?.pickupState, order.delivery?.destinationState].filter(Boolean).join(" → ") || "Route not recorded"}</small>
                <small className="delivery-reference">{order.delivery?.providerShipmentId || order.delivery?.trackingRef || order.delivery?.legacyTrackingRef || "No shipment ID yet"}</small>
              </> : <><strong>{order.payment.title}</strong><small>{order.payment.source}</small><small>Produce: {formatMoney(order.totalMinor)}</small><small>Held: {formatMoney(order.payment.heldMinor)}</small><small>Farmer payment: {order.payment.transfer}</small></>}</td>
              <td><strong>{financeLabel(order.farmer.decision)}</strong><small>{order.farmer.decidedAt ? financeDate(order.farmer.decidedAt) : "Decision not recorded yet"}</small><small>{order.fulfillment.status} · {order.fulfillment.method}</small>
                {order.fulfillment.readyAt && <small>Ready: {financeDate(order.fulfillment.readyAt)}</small>}
                {order.fulfillment.dispatchedAt && <small>Farmer handoff: {financeDate(order.fulfillment.dispatchedAt)}</small>}
                <small>{order.fulfillment.receiptConfirmedAt ? `${order.fulfillment.receiptSource === "legacy-staff" ? "Legacy staff confirmation" : "Buyer receipt"}: ${financeDate(order.fulfillment.receiptConfirmedAt)}` : "Buyer receipt not confirmed"}</small>
              </td>
              <td>{dispatch ? order.delivery?.assignments.map((assignment, index) => <div key={index} className="dispatch-package">
                {order.delivery!.packageCount > 1 && <strong>Package {(assignment.parcelIndex ?? index) + 1} · {deliveryStatusCopy(assignment.status).label}</strong>}
                <small>{assignment.rider ? [assignment.rider.name, assignment.rider.phone].filter(Boolean).join(" · ") : order.delivery?.provider === "Shipbubble" ? "Rider details not supplied by provider" : "Rider details not recorded"}</small>
                {assignment.courier.phone && <small>Courier contact: {assignment.courier.phone}</small>}
                {assignment.trackingUrl && safeTrackingUrl(assignment.trackingUrl) && <a href={assignment.trackingUrl} target="_blank" rel="noopener noreferrer">Open provider tracking{order.delivery!.packageCount > 1 ? ` · Package ${(assignment.parcelIndex ?? index) + 1}` : ""}</a>}
              </div>) : <><strong>{order.delivery?.label || (order.fulfillment.method === "Pickup" ? "Buyer collection" : "Not arranged")}</strong><small>{order.delivery?.courier}</small></>}
                {order.delivery && <small>{order.delivery.deliveredPackages} of {order.delivery.packageCount} packages delivered</small>}
              </td>
              <td><small>Courier check: {order.delivery?.lastSyncedAt ? financeDate(order.delivery.lastSyncedAt) : "Not recorded"}</small><small>Progress: {order.delivery?.lastProgressAt ? financeDate(order.delivery.lastProgressAt) : "Not recorded"}</small></td>
              <td>{order.issues.length ? order.issues.map(issue => <p key={issue.code} className="dispatch-issue" title={issue.body}>{issue.title}</p>) : <small>No flagged issue</small>}</td>
              <td><button className="secondary" onClick={() => filters({ id: order.id })} aria-label={`Investigate ${order.reference}`}>Investigate →</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!data.items.length && <div className="live-empty"><h2>No matching {dispatch ? "deliveries" : "orders"}</h2><p>Try another status, decision or operational view.</p></div>}
        <div className="live-pagination"><span>{data.total} records · Page {page}</span>
          <button className="secondary" disabled={busy || page <= 1} onClick={() => filters({ page: String(page - 1) })}>Previous</button>
          <button className="secondary" disabled={busy || page * data.pageSize >= data.total} onClick={() => filters({ page: String(page + 1) })}>Next</button>
        </div>
      </>}
    </section>
    {orderId && <section className="live-card dispatch-review" ref={detail} tabIndex={-1} aria-label="Order and delivery investigation">
      <div className="dispatch-toolbar"><h2>Order and delivery investigation</h2><button className="secondary" onClick={() => filters({ id: null })}>Close investigation</button></div>
      <CustomerDelivery key={orderId} id={orderId} staff staffPermissions={permissions} onChanged={() => void load()} />
    </section>}
  </div>;
}
