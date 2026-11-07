"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { userFacingError } from "../../lib/user-facing-error";
import { financeRequest } from "./finance-ui";
import type { AdminOrderCommand, AdminOrderRecord } from "./order-types";

const financialCommands = ["escrow", "delivery-payment"];
const sensitiveCommands = ["escrow", "delivery-payment", "link", "link-parcel", "cancel-delivery"];

/** Visibility only; the existing API remains authoritative for every write. */
export function orderCommandAvailable(command: AdminOrderCommand, data: AdminOrderRecord, permissions: readonly string[]) {
  if (!permissions.includes("orders.read") || !permissions.includes(financialCommands.includes(command) ? "payments.manage" : "orders.manage")) return false;
  const { order, delivery: d, staffContext: context } = data;
  const editable = order.status === "AWAITING_PAYMENT" && !order.checkoutActive && !context.financialHold &&
    !data.legacyShipment && !BigInt(d?.paidMinor || "0") && !d?.bookingStartedAt && !d?.providerShipmentId;
  switch (command) {
    case "cancel-order": return order.status === "AWAITING_PAYMENT" && !order.checkoutActive && !context.financialHold;
    case "escrow": return context.fundsProvider !== "bachs" && context.manualEscrowKinds.length > 0;
    case "assign-shipment": return order.status === "FUNDED" && !d && !data.legacyShipment;
    case "legacy-status": return !!data.legacyShipment && ["ASSIGNED", "IN_TRANSIT"].includes(data.legacyShipment.status) &&
      ["FUNDED", "DELIVERED"].includes(order.status) && BigInt(data.money.heldMinor) > 0n;
    case "quotes": return editable && !!order.packageSuggestion;
    case "select": return editable && !!d?.quotes.some(quote => quote.available && new Date(quote.expiresAt).getTime() > Date.now());
    case "refresh-quote": return !!d?.selectedQuoteId && !d.providerShipmentId && !d.bookingStartedAt &&
      ["AWAITING_PAYMENT", "FUNDED"].includes(order.status) && !order.checkoutActive && !context.financialHold;
    case "book": return order.status === "FUNDED" && !!d && ["PAID", "BOOKING_BLOCKED"].includes(d.status) &&
      !d.bookingStartedAt && !d.providerShipmentId && !d.cancelRequestedAt && !!d.selectedQuoteId &&
      BigInt(d.paidMinor) >= BigInt(d.shippingMinor) && !order.checkoutActive && !context.financialHold &&
      !["PENDING", "REJECTED"].includes(order.farmerDecision) && d.failureCode !== "DELIVERY_PRICE_CHANGED" &&
      (order.journeyVersion < 2 || d.events.some(event => event.status === "READY_FOR_PICKUP"));
    case "manual-dispatch": return !!d && d.status === "MANUAL_REVIEW" && order.status === "FUNDED" &&
      !d.providerShipmentId && !context.financialHold && !order.checkoutActive;
    case "manual-status": return context.manualDeliveryStatuses.length > 0 && !order.checkoutActive;
    case "reconcile": return !!d?.providerShipmentId && !["CANCELLED", "RETURNED", "BOOKING_UNCERTAIN", "BOOKING_BLOCKED", "BOOKING"].includes(d.status);
    case "link": return !!d && d.status === "BOOKING_UNCERTAIN" && !d.providerShipmentId && !d.parcels.length;
    case "link-parcel": return !!d && d.status === "BOOKING_UNCERTAIN" && d.parcels.some(parcel =>
      !parcel.providerShipmentId && ["BOOKING", "BOOKING_UNCERTAIN"].includes(parcel.status));
    case "delivery-payment": return !!d && context.fundsProvider !== "bachs" && ["PAYMENT_PENDING", "PAID"].includes(d.status) &&
      !BigInt(d.paidMinor) && !order.checkoutActive && d.quotes.some(quote => quote.id === d.selectedQuoteId &&
        quote.available && new Date(quote.expiresAt).getTime() > Date.now());
    case "cancel-delivery": return !!d?.providerShipmentId && !d.cancelRequestedAt && !["DELIVERED", "CANCELLED", "RETURNED"].includes(d.status);
  }
}

export function useOrderRecord(id: string, permissions: readonly string[], onChanged?: () => void) {
  const [snapshot, setSnapshot] = useState<{ id: string; record: AdminOrderRecord }>();
  const [loading, setLoading] = useState(false), [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState(""), [actionError, setActionError] = useState(""), [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const mounted = useRef(false), scope = useRef(0), requests = useRef(0), reading = useRef(false), running = useRef(false);
  const record = snapshot?.id === id ? snapshot.record : undefined;
  const context = useRef({ id, permissions, record, loadError, dirty, onChanged });
  context.current = { id, permissions, record, loadError, dirty, onChanged };
  const canRead = permissions.includes("orders.read");
  const current = () => mounted.current && context.current.id === id;
  const load = useCallback(async () => {
    if (!canRead) return;
    const version = ++requests.current;
    reading.current = true;
    setLoading(true);
    try {
      const next: AdminOrderRecord = await financeRequest(`delivery-orders/${id}/delivery`);
      if (!mounted.current || context.current.id !== id || requests.current !== version) return;
      if (next.order.id !== id || !next.staffContext) throw new Error("This order could not be loaded. Please retry.");
      setSnapshot({ id, record: next });
      setLoadError("");
    } catch (failure) {
      if (mounted.current && context.current.id === id && requests.current === version) setLoadError(userFacingError(failure));
    } finally {
      if (mounted.current && context.current.id === id && requests.current === version) {
        reading.current = false;
        setLoading(false);
      }
    }
  }, [id, canRead]);
  useEffect(() => {
    scope.current++;
    mounted.current = true;
    running.current = false;
    setSnapshot(undefined);
    setNotice(""); setLoadError(""); setActionError(""); setDirty(false); setPending(false);
    void load();
    const refresh = () => {
      if (!reading.current && !running.current && document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted.current = false;
      scope.current++;
      requests.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  async function execute(command: AdminOrderCommand, body: Record<string, unknown> = {}, code = "") {
    const actionScope = scope.current;
    const actionCurrent = () => current() && actionScope === scope.current;
    const data = context.current.record;
    if (!current() || running.current || reading.current || context.current.loadError || !data ||
      !orderCommandAvailable(command, data, context.current.permissions)) return false;
    if (["select", "refresh-quote"].includes(command) && context.current.dirty) return false;
    if (command === "select" && !data.delivery?.quotes.some(quote => quote.id === body.quoteId && quote.available && new Date(quote.expiresAt).getTime() > Date.now())) return false;
    if (command === "escrow" && !data.staffContext.manualEscrowKinds.includes(String(body.kind))) return false;
    if (command === "link-parcel" && !data.delivery?.parcels.some(parcel => parcel.id === body.parcelId && !parcel.providerShipmentId && ["BOOKING", "BOOKING_UNCERTAIN"].includes(parcel.status))) return false;
    const sensitive = sensitiveCommands.includes(command);
    if (sensitive && !/^\d{6}$/.test(code)) { setActionError("Enter the six-digit code from your authenticator."); return false; }
    const paths: Partial<Record<AdminOrderCommand, string>> = {
      "cancel-order": `orders/${id}/cancel`, escrow: `orders/${id}/escrow`,
      "assign-shipment": "logistics", "legacy-status": `logistics/${data.legacyShipment?.id}/status`,
      "delivery-payment": `delivery-orders/${id}/delivery/payment`,
      "cancel-delivery": `delivery-orders/${id}/delivery/cancel`,
      "link-parcel": `delivery-orders/${id}/delivery/parcels/${encodeURIComponent(String(body.parcelId))}/link`,
    };
    const path = paths[command] || `delivery-orders/${id}/delivery/${command}`;
    const payload = { ...body };
    delete payload.parcelId;
    if (command === "assign-shipment") payload.orderId = id;
    running.current = true;
    setPending(true); setActionError(""); setNotice("");
    try {
      if (sensitive) {
        await financeRequest("auth/totp/step-up", { code });
        if (!actionCurrent() || !context.current.record || !orderCommandAvailable(command, context.current.record, context.current.permissions)) return false;
      }
      const result = await financeRequest(path, payload);
      if (!actionCurrent()) return false;
      setNotice(result.message || "Action saved. The updated record is shown below.");
      if (["quotes", "select", "refresh-quote"].includes(command)) setDirty(false);
      context.current.onChanged?.();
      await load();
      return actionCurrent();
    } catch (failure) {
      if (actionCurrent()) {
        setActionError(userFacingError(failure));
        await load();
      }
      return false;
    } finally {
      if (actionCurrent()) { running.current = false; setPending(false); }
    }
  }
  return {
    record, loading, pending, disabled: loading || pending || !!loadError, loadError, actionError, notice, dirty,
    markDirty: () => { context.current.dirty = true; setDirty(true); }, load, execute,
    available: (command: AdminOrderCommand) => !!record && orderCommandAvailable(command, record, permissions),
  };
}
export type OrderRecordWorkflow = ReturnType<typeof useOrderRecord>;
