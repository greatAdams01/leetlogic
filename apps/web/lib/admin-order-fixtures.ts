import { deliveryVisibility } from "../../../packages/contracts/src/delivery-visibility";
import { orderFulfillment } from "../../../packages/contracts/src/order-fulfillment";
import { orderPaymentProgress } from "../../../packages/contracts/src/order-payment-progress";
import type { AdminOrderRecord, QueueData } from "../components/admin/order-types";

export const orderId = "11111111-1111-4111-8111-111111111111";
export const otherOrderId = "22222222-2222-4222-8222-222222222222";
export const parcelId = "33333333-3333-4333-8333-333333333333";
export const staffPermissions = ["orders.read", "orders.manage", "payments.read", "payments.manage", "disputes.manage"];

export function adminOrderFixture(): AdminOrderRecord {
  const now = Date.now(), at = (offset: number) => new Date(now + offset).toISOString();
  const pickup: AdminOrderRecord["order"]["suggestedPickup"] = { name: "Ada Farmer", email: "farmer@example.test", phone: "+2348011111111", address: "12 Farm Road", state: "Benue", country: "NG", instructions: "Use the farm gate" };
  const destination: AdminOrderRecord["order"]["suggestedPickup"] = { name: "Bola Buyer", email: "buyer@example.test", phone: "+2348022222222", address: "24 Market Road", state: "Lagos", country: "NG", instructions: "Call at the market gate" };
  const delivery: NonNullable<AdminOrderRecord["delivery"]> = {
    id: "44444444-4444-4444-8444-444444444444", status: "BOOKED", courier: "Test Courier", providerShipmentId: "SB-BOOKING-1", selectedQuoteId: "quote-1",
    bookingStartedAt: at(-600000), cancelRequestedAt: null, shippingMinor: "20000", paidMinor: "20000", failureCode: null, operationsNotes: null,
    pickup, destination, package: { packageCount: 1, weightKg: 5, length: 25, width: 20, height: 15, handling: "PERISHABLE", pickupDate: at(0).slice(0, 10) },
    parcels: [], events: [
      { id: "ready", status: "READY_FOR_PICKUP", source: "farmer", createdAt: at(-700000) },
      { id: "booked", status: "BOOKED", source: "system", createdAt: at(-600000) },
      { id: "contacts", status: "PROVIDER_CONTACT_UPDATED", source: "shipbubble", createdAt: at(-500000), details: { providerShipmentId: "SB-BOOKING-1", courier: { name: "Test Courier", phone: "+2348033333333" }, rider: { name: "Rider Chidi", phone: "+2348044444444" } } },
    ], quotes: [{ id: "quote-1", courier: "Test Courier", amountMinor: "20000", available: true, expiresAt: at(600000), eta: "1–2 days" }],
  };
  return {
    observedAt: at(0), staffContext: { revision: "a".repeat(64), buyerContact: { name: destination.name, phone: destination.phone, email: destination.email }, fulfillmentNotes: null,
      corrections: { orderInformation: true, deliveryNotes: true, destination: false, riderAssignment: false, destinationRequiresNewQuote: false, providerControlled: true },
      activity: { through: "1", nextCursor: null, hasMore: false, completeFrom: null, items: [{ id: "1", orderId, entityType: "order", entityId: orderId, kind: "INSERT", action: "order.created", actorType: "buyer", actorId: otherOrderId, actorName: "Bola Buyer", reason: null, before: null, after: { status: "AWAITING_PAYMENT", quantity: "10", totalMinor: "100000" }, occurredAt: at(-3600000), requestId: null }] },
      buyer: { name: "Bola Buyer", phone: destination.phone }, farmer: { name: "Ada Farmer", farmName: "Ada’s farm", phone: pickup.phone },
      createdAt: at(-3600000), farmerDecidedAt: at(-1800000), fundsProvider: "bachs", manualFundingRecorded: false, financialHold: false,
      disputes: [], ledger: [], manualEscrowKinds: [], manualDeliveryStatuses: [] },
    order: { id: orderId, reference: "LL-1042", status: "FUNDED", title: "Fresh tomatoes", description: "Fresh farm produce.", journeyVersion: 2,
      listingId: "listing", quantity: "10", unitCode: "kg", totalMinor: "100000", totalWithDeliveryMinor: "120000", checkoutReady: false, checkoutActive: false,
      farmerDecision: "ACCEPTED", rejectionReason: null, handedOverAt: null, deliveryConfirmedAt: null, receiptPhoto: null,
      suggestedPickup: pickup, packageSuggestion: { packageCount: 1, weightKg: 5, length: 25, width: 20, height: 15, handling: "PERISHABLE" } },
    money: { heldMinor: "100000", releasedMinor: "0", refundedMinor: "0", release: null, progress: orderPaymentProgress({ verified: true, heldMinor: "100000", releaseEnabled: true }) },
    progress: orderFulfillment({ farmerDecision: "ACCEPTED", paid: true, confirmed: false, blocked: false, buyer: false, farmer: false, status: "BOOKED", ready: true, dispatched: false, booked: true, receiptReady: false, collection: false }),
    fulfillment: null, legacyShipment: null, manualShipment: null, delivery,
    tracking: deliveryVisibility({ ...delivery, createdAt: at(-800000), lastSyncedAt: at(-500000), orderStatus: "FUNDED" }, new Date(now)),
  };
}

export function adminQueueFixture(record = adminOrderFixture()): QueueData {
  return {
    total: 31, page: 1, pageSize: 25, observedAt: record.observedAt,
    counts: { pending: 7, active: 12, attention: 3, delivered: 9 }, orderCounts: { all: 31, awaitingPayment: 8, awaitingFarmer: 5, attention: 3 },
    items: [{ id: record.order.id, reference: record.order.reference, status: record.order.status, createdAt: record.staffContext.createdAt,
      listing: { title: record.order.title, unitCode: record.order.unitCode }, quantity: record.order.quantity, totalMinor: record.order.totalMinor,
      buyer: record.staffContext.buyer, farmer: { ...record.staffContext.farmer, decision: record.order.farmerDecision, decidedAt: record.staffContext.farmerDecidedAt },
      fulfillment: { status: record.progress.status, method: record.progress.method, next: record.progress.next, receiptConfirmedAt: record.order.deliveryConfirmedAt, receiptSource: "buyer" },
      payment: { ...record.money.progress, source: "Bachs", heldMinor: record.money.heldMinor, releasedMinor: "0", refundedMinor: "0" },
      delivery: record.tracking ? { ...record.tracking, id: record.delivery!.id, pickupState: "Benue", destinationState: "Lagos", providerShipmentId: record.delivery!.providerShipmentId, legacyTrackingRef: null } : null,
      issues: [],
    }],
  };
}
