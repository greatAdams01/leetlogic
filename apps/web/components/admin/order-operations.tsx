"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { deliveryActiveStates, deliveryPendingStates, deliveryStatusCopy } from "../../../../packages/contracts/src/delivery-visibility";
import { formatMoney } from "../../../../packages/contracts/src/money";
import { operationsDetailLink, operationsDetailRoute, operationsQueuePath } from "../../lib/admin-order-navigation";
import { userFacingError } from "../../lib/user-facing-error";
import { financeDate, financeRequest } from "./finance-ui";
import { farmerDecisionLabel, OperationsBadge, orderStatusLabel } from "./order-ui";
import type { QueueData, QueueOrder } from "./order-types";

const deliveryViews = [
  ["ALL", "All deliveries"], ["ATTENTION", "Needs attention"], ["PENDING", "To arrange"],
  ["ACTIVE", "In progress"], ["DELIVERED", "Delivered"], ["FAILED", "Delivery problems"],
  ["DELAYED", "Possible delay"], ["STALE", "Tracking update overdue"],
] as const;

export function OrderOperations({ dispatch = false, permissions }: { dispatch?: boolean; permissions: string[] }) {
  const router = useRouter(), params = useSearchParams(), base = dispatch ? "logistics" : "orders";
  const query = params.get("search") || "", status = params.get("status") || "ALL", farmer = params.get("farmer") || "ALL", view = params.get("view") || "ALL";
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.get("page")) || 1)));
  const path = `${dispatch ? "dispatch" : "order-operations"}?${new URLSearchParams({ page: String(page), search: query, status, farmer, view })}`;
  const returnTo = operationsQueuePath(base, new URLSearchParams(params.toString()));
  const canRead = permissions.includes("orders.read");
  const [search, setSearch] = useState(query), [snapshot, setSnapshot] = useState<{ path: string; data: QueueData }>(), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), requests = useRef(0), loading = useRef(false);
  const data = snapshot?.path === path ? snapshot.data : undefined;
  useEffect(() => setSearch(query), [query]);
  const oldId = params.get("id");
  useEffect(() => {
    if (oldId && operationsDetailRoute(`${base}/${oldId}`))
      router.replace(operationsDetailLink(base, oldId, returnTo));
  }, [oldId, base, returnTo, router]);
  const filters = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("id");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.push(operationsQueuePath(base, next), { scroll: false });
  };
  const load = useCallback(async () => {
    if (!canRead) return;
    const version = ++requests.current;
    loading.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await financeRequest(path) as QueueData;
      if (version !== requests.current) return;
      setSnapshot({ path, data: next });
    } catch (failure) {
      if (version === requests.current) setError(userFacingError(failure));
    } finally {
      if (version === requests.current) { loading.current = false; setBusy(false); }
    }
  }, [path, canRead]);
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
  const metrics = dispatch ? [
    { label: "To arrange", count: data?.counts.pending, filters: { view: "PENDING", status, farmer } },
    { label: "In progress", count: data?.counts.active, filters: { view: "ACTIVE", status, farmer } },
    { label: "Needs attention", count: data?.counts.attention, filters: { view: "ATTENTION", status, farmer } },
    { label: "Delivered", count: data?.counts.delivered, filters: { view: "DELIVERED", status, farmer } },
  ] : [
    { label: "All orders", count: data?.orderCounts?.all, filters: { view: "ALL", status: "ALL", farmer: "ALL" } },
    { label: "Awaiting payment", count: data?.orderCounts?.awaitingPayment, filters: { view: "ALL", status: "AWAITING_PAYMENT", farmer: "ALL" } },
    { label: "Awaiting farmer", count: data?.orderCounts?.awaitingFarmer, filters: { view: "ALL", status: "FUNDED", farmer: "PENDING" } },
    { label: "Needs attention", count: data?.orderCounts?.attention ?? data?.counts.attention, filters: { view: "ATTENTION", status: "ALL", farmer: "ALL" } },
  ];
  const hasFilters = !!query || status !== "ALL" || farmer !== "ALL" || view !== "ALL";
  const statuses = dispatch ? [...new Set([...deliveryPendingStates, ...deliveryActiveStates, "DELIVERED", "RETURNED", "CANCELLED"])]
    : ["AWAITING_PAYMENT", "FUNDED", "DELIVERED", "COMPLETED", "REFUNDED", "CANCELLED", "UNDER_INVESTIGATION"];
  if (!canRead) return <section className="live-card"><p role="alert">You do not have permission to view {dispatch ? "deliveries" : "orders"}.</p></section>;
  return <div className="operations-workspace">
    <nav className="finance-tabs" aria-label="Orders and deliveries">
      <Link href="/admin/orders" aria-current={!dispatch ? "page" : undefined}>Orders</Link>
      <Link href="/admin/logistics" aria-current={dispatch ? "page" : undefined}>Deliveries</Link>
    </nav>
    <div className="dispatch-metrics" aria-label={dispatch ? "Delivery counts" : "Order counts"}>
      {metrics.map(metric => {
        const selected = metric.filters.view === view && metric.filters.status === status && metric.filters.farmer === farmer;
        return <button key={metric.label} className={`dispatch-metric ${selected ? "selected" : ""}`} aria-label={`${metric.label} ${metric.count ?? "Not available"}`} aria-pressed={selected} onClick={() => filters({ ...metric.filters, page: "1" })}>
          <span>{metric.label}</span><strong>{metric.count ?? "—"}</strong>
        </button>;
      })}
    </div>
    <section className="live-card operations-queue-card">
      <div className="finance-section-heading">
        <div><h2>{dispatch ? "Dispatch queue" : "Order list"}</h2><p>{dispatch ? "Buyer collections stay in Orders. Open a delivery for contacts, tracking and dispatch actions." : "Open an order for produce, contacts, payments and fulfillment actions."}</p></div>
        <button className="secondary" disabled={busy} onClick={() => void load()}>Refresh</button>
      </div>
      <form className="dispatch-filters" onSubmit={event => { event.preventDefault(); filters({ search, page: "1" }); }}>
        <label>{dispatch ? "Search deliveries" : "Search orders"}<input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder={dispatch ? "Order reference, courier or tracking reference" : "Order reference, produce, buyer or farmer"} /></label>
        {dispatch ? <label>Show deliveries<select value={view} onChange={event => filters({ view: event.target.value, page: "1" })}>{deliveryViews.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          : <label>Order status<select value={status} onChange={event => filters({ status: event.target.value, page: "1" })}><option value="ALL">All statuses</option>{statuses.map(value => <option key={value} value={value}>{orderStatusLabel(value)}</option>)}</select></label>}
        {!dispatch && <label>Farmer response<select value={farmer} onChange={event => filters({ farmer: event.target.value, page: "1" })}>
          <option value="ALL">All responses</option>{["PENDING", "ACCEPTED", "REJECTED", "LEGACY"].map(value => <option key={value} value={value}>{farmerDecisionLabel(value)}</option>)}
        </select></label>}
        <button className="secondary">Search</button>
        {hasFilters && <button type="button" className="secondary" onClick={() => filters({ search: null, status: null, farmer: null, view: null, page: null })}>Clear filters</button>}
      </form>
      {dispatch && <div className="operations-more-filters"><label>Delivery status<select value={status} onChange={event => filters({ status: event.target.value, page: "1" })}>
        <option value="ALL">All statuses</option>{statuses.map(value => <option key={value} value={value}>{deliveryStatusCopy(value).label}</option>)}
      </select></label></div>}
      {error && <p className="live-error" role="alert">{error}{data ? ` Showing the last update from ${financeDate(data.observedAt)}.` : ""}</p>}
      {!data && busy && <p role="status">Loading {dispatch ? "deliveries" : "orders"}…</p>}
      {data && <>
        <p className="dispatch-observed">{data.total} matching {dispatch ? "deliveries" : "orders"} · Updated {financeDate(data.observedAt)} (WAT). Refreshes automatically.</p>
        <div className="live-table-wrap">
          <table className="operations-queue" role="table" aria-label={dispatch ? "Deliveries" : "Orders"}>
            <thead role="rowgroup"><tr role="row"><th scope="col">{dispatch ? "Delivery / route" : "Order / produce"}</th><th scope="col">{dispatch ? "Courier / rider" : "Buyer / farmer"}</th><th scope="col">{dispatch ? "Delivery progress" : "Payment"}</th><th scope="col">{dispatch ? "Attention" : "Fulfillment"}</th><th scope="col">Details</th></tr></thead>
            <tbody role="rowgroup">{data.items.map(order => {
              const href = operationsDetailLink(base, order.id, returnTo);
              return <tr key={order.id} role="row">
                <td role="cell" data-label={dispatch ? "Delivery / route" : "Order / produce"}><Link className="operations-record-link" href={href}>{order.reference}</Link><small>{order.listing.title} · {order.quantity} {order.listing.unitCode}</small>
                  {dispatch ? <small>{[order.delivery?.pickupState, order.delivery?.destinationState].filter(Boolean).join(" → ") || "Route available in delivery details"}</small>
                    : <><small>{financeDate(order.createdAt)}</small><OperationsBadge value={order.status} label={orderStatusLabel(order.status)} /></>}
                </td>
                <td role="cell" data-label={dispatch ? "Courier / rider" : "Buyer / farmer"}>{dispatch ? <CourierSummary order={order} /> : <><strong>{order.buyer.name}</strong><small>Farmer: {order.farmer.farmName}</small></>}</td>
                <td role="cell" data-label={dispatch ? "Delivery progress" : "Payment"}>{dispatch ? <>
                  <OperationsBadge value={order.delivery?.status || "PENDING"} label={order.delivery?.label} />
                  {order.delivery && order.delivery.packageCount > 1 && <small>{order.delivery.deliveredPackages} of {order.delivery.packageCount} packages delivered</small>}
                  <small>{order.delivery?.lastSyncedAt ? `Last checked ${financeDate(order.delivery.lastSyncedAt)}` : "No courier update yet"}</small>
                </> : <><strong>{formatMoney(order.totalMinor)}</strong><small>{order.payment.title}</small>{order.payment.source === "Manual escrow" && <small>Manually recorded</small>}</>}</td>
                <td role="cell" data-label={dispatch ? "Attention" : "Fulfillment"}>{dispatch ? <IssueSummary order={order} /> : <>
                  <strong>{order.status === "AWAITING_PAYMENT" ? "Waiting for payment" : order.farmer.decision === "PENDING" && order.status === "FUNDED" ? "Awaiting farmer acceptance" : order.fulfillment.status}</strong>
                  <small>{order.fulfillment.method === "Pickup" ? "Buyer collection" : "Courier delivery"} · {farmerDecisionLabel(order.farmer.decision)}</small>
                  {!!order.issues.length && <IssueSummary order={order} />}
                </>}</td>
                <td role="cell" data-label="Details"><Link className="finance-review-link" href={href} aria-label={`View ${dispatch ? "delivery" : "order"} ${order.reference}`}>View {dispatch ? "delivery" : "order"} →</Link></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!data.items.length && <div className="live-empty"><h2>No matching {dispatch ? "deliveries" : "orders"}</h2><p>{hasFilters ? "Try another search or clear the filters." : dispatch ? "Deliveries will appear when courier delivery is arranged. Buyer collections are managed in Orders." : "Orders will appear when a buyer places an order."}</p></div>}
        <div className="live-pagination"><span>Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
          <button className="secondary" disabled={busy || page <= 1} onClick={() => filters({ page: String(page - 1) })}>Previous</button>
          <button className="secondary" disabled={busy || page * data.pageSize >= data.total} onClick={() => filters({ page: String(page + 1) })}>Next</button>
        </div>
      </>}
    </section>
    <div className="operations-other-tools"><Link href={`/admin/${base}?legacy=1`}>Older {dispatch ? "shipment" : "order"} records and exports</Link></div>
  </div>;
}

function IssueSummary({ order }: { order: QueueOrder }) {
  return order.issues.length ? <p className="dispatch-issue">{order.issues[0].title}{order.issues.length > 1 && <span> · +{order.issues.length - 1} more</span>}</p> : <small>No issues flagged</small>;
}

function CourierSummary({ order }: { order: QueueOrder }) {
  const riders = [...new Set(order.delivery?.assignments.flatMap(assignment => assignment.rider?.name ? [assignment.rider.name] : []) || [])];
  return <><strong>{order.delivery?.courier || "Courier not assigned"}</strong><small>{riders.length ? `Rider: ${riders.join(", ")}` : "Rider details not available yet"}</small></>;
}
