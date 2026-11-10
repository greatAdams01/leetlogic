import { orderStatusLabel } from "./order-ui";
import { deliveryStatusCopy } from "../../../../packages/contracts/src/delivery-visibility";
import { resolutionFinancialLabels } from "../../../../packages/contracts/src/order-resolution";
import { historyChanges, type HistoryChange } from "../../../../packages/contracts/src/admin-order-history";
import type { AdminOrderCommand, AdminOrderRecord } from "./order-types";

/** Describe the intervention, not an unverified provider or financial outcome. */
export function orderCommandChanges(command: AdminOrderCommand, body: Record<string, any>, data: AdminOrderRecord): HistoryChange[] {
  const d = data.delivery, s = data.manualShipment || data.legacyShipment;
  switch (command) {
    case "resolve": return historyChanges({ orderStatus: orderStatusLabel(data.order.status), deliveryStatus: d?.status || s?.status ? deliveryStatusCopy(d?.status || s!.status).label : "Not arranged", financialOutcome: "Current payment records retained" },
      { orderStatus: orderStatusLabel(body.outcome), deliveryStatus: body.outcome === "UNDER_INVESTIGATION" ? (d?.status || s?.status ? deliveryStatusCopy(d?.status || s!.status).label : "Not arranged") : body.outcome === "COMPLETED" ? "Completed by administrator" : "Cancelled by administrator",
        financialOutcome: resolutionFinancialLabels[body.financialAction as keyof typeof resolutionFinancialLabels],
        shippingRefundMinor: body.shippingRefundMinor || "0", evidence: body.evidence });
    case "correct-order": return historyChanges(Object.fromEntries(Object.keys(body.changes).map(key => [key,
      key === "buyerContact" ? data.staffContext.buyerContact : data.staffContext.fulfillmentNotes])), body.changes);
    case "correct-delivery": return historyChanges(Object.fromEntries(Object.keys(body.changes).map(key => [key,
      key === "riderAssignment" ? data.manualShipment?.riderAssignment : key === "destination" ? d?.destination : d?.operationsNotes])), body.changes);
    case "cancel-order": return historyChanges({ status: data.order.status }, { status: "CANCELLED" });
    case "quotes": return historyChanges({ pickup: d?.pickup, destination: d?.destination, pickupDate: d?.package?.pickupDate },
      { pickup: body.pickup, destination: body.destination, pickupDate: body.parcel?.pickupDate });
    case "select": {
      const quote = d?.quotes.find(item => item.id === body.quoteId);
      return historyChanges({ selectedQuoteId: d?.selectedQuoteId, courier: d?.courier, shippingMinor: d?.shippingMinor },
        { selectedQuoteId: body.quoteId, courier: quote?.courier, shippingMinor: quote?.amountMinor });
    }
    case "assign-shipment": case "manual-dispatch": return historyChanges({ carrier: s?.carrier, trackingRef: s?.trackingRef },
      { carrier: body.carrier, trackingRef: body.trackingRef });
    case "legacy-status": case "manual-status": return historyChanges({ status: command === "legacy-status" ? s?.status : d?.status, evidence: data.legacyShipment?.evidence },
      { status: body.status, evidence: body.evidence });
    case "delivery-payment": return historyChanges({ paidMinor: d?.paidMinor, externalRef: null }, { paidMinor: body.amountMinor, externalRef: body.reference });
    case "escrow": return historyChanges({ paymentAction: "No new manual intervention", amountMinor: null, externalRef: null },
      { paymentAction: body.kind, amountMinor: body.amountMinor, externalRef: body.externalRef || null });
    case "link": case "link-parcel": return historyChanges({ providerShipmentId: command === "link-parcel" ? d?.parcels.find(item => item.id === body.parcelId)?.providerShipmentId : d?.providerShipmentId },
      { providerShipmentId: body.providerShipmentId });
    case "book": return historyChanges({ status: d?.status }, { status: "BOOKING_QUEUED" });
    case "cancel-delivery": return historyChanges({ cancellationRequest: d?.cancelRequestedAt || "Not requested" }, { cancellationRequest: "Request courier cancellation; await confirmation" });
    case "reconcile": return historyChanges({ trackingRefresh: "Recorded courier status retained" }, { trackingRefresh: "Queue a verified courier status check" });
    case "refresh-quote": return historyChanges({ quoteRefresh: "Current quote" }, { quoteRefresh: "Retire the old quote and request a verified current rate" });
  }
}
