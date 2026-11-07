import type { DeliveryVisibility, DeliveryVisibilityEvent, DeliveryVisibilityParcel } from "../../../../packages/contracts/src/delivery-visibility";
import type { OrderFulfillment } from "../../../../packages/contracts/src/order-fulfillment";
import type { OrderPaymentProgress } from "../../../../packages/contracts/src/order-payment-progress";
import type { Contact } from "../../../mobile/src/lib/domain";

type Party = { name: string; phone: string };
type Packing = {
  packageCount: number; weightKg: number; length: number; width: number; height: number;
  handling: string; notes?: string; pickupInstructions?: string;
};
export type QueueOrder = {
  id: string; reference: string; status: string; createdAt: string;
  listing: { title: string; unitCode: string }; quantity: string; totalMinor: string;
  buyer: Party;
  farmer: Party & { farmName: string; decision: string; decidedAt: string | null };
  fulfillment: { status: string; method: string; next: string; receiptConfirmedAt: string | null; receiptSource: string };
  payment: OrderPaymentProgress & { source: string; heldMinor: string; releasedMinor: string; refundedMinor: string };
  delivery: null | Omit<DeliveryVisibility, "timeline" | "milestones"> & {
    id: string; pickupState: string | null; destinationState: string | null;
    providerShipmentId: string | null; legacyTrackingRef: string | null;
  };
  issues: { code: string; title: string; body: string }[];
};
export type QueueData = {
  items: QueueOrder[]; total: number; page: number; pageSize: number; observedAt: string;
  counts: { pending: number; active: number; attention: number; delivered: number };
  orderCounts?: { all: number; awaitingPayment: number; awaitingFarmer: number; attention: number };
};

/** The existing staff delivery endpoint is the source for both dedicated detail pages. */
export type AdminOrderRecord = {
  observedAt: string;
  staffContext: {
    buyer: Party; farmer: Party & { farmName: string }; farmerDecidedAt: string | null;
    createdAt: string; fundsProvider: string | null; manualFundingRecorded: boolean; financialHold: boolean;
    disputes: { id: string; subject: string; status: string }[];
    ledger: { id: string; kind: string; amountMinor: string; feeMinor: string; externalRef: string | null; reason: string; createdAt: string }[];
    manualEscrowKinds: string[]; manualDeliveryStatuses: string[];
  };
  order: {
    id: string; reference: string; status: string; title: string; description?: string; journeyVersion: number;
    listingId: string; quantity: string; unitCode: string; totalMinor: string;
    totalWithDeliveryMinor: string | null; checkoutReady: boolean; checkoutActive: boolean;
    farmerDecision: string; rejectionReason: string | null; handedOverAt: string | null;
    deliveryConfirmedAt: string | null; receiptPhoto: { uploadedAt: string; url: string } | null;
    suggestedPickup: Contact; packageSuggestion: Packing | null;
  };
  money: {
    progress: OrderPaymentProgress; heldMinor: string; releasedMinor: string; refundedMinor: string;
    release: { status: string; failureCode: string | null; updatedAt: string } | null;
  };
  progress: OrderFulfillment;
  fulfillment: { state: string; refundDueAt: string; failureCode?: string | null } | null;
  tracking: DeliveryVisibility | null;
  legacyShipment: {
    id: string; carrier: string; trackingRef: string; status: string; evidence: string | null;
    createdAt: string; updatedAt: string;
  } | null;
  delivery: {
    id: string; status: string; courier: string | null; providerShipmentId: string | null;
    selectedQuoteId: string | null; bookingStartedAt: string | null; cancelRequestedAt: string | null;
    shippingMinor: string; paidMinor: string; failureCode: string | null;
    pickup: Contact | null; destination: Contact | null; package: (Partial<Packing> & { pickupDate?: string; quoteRequestId?: string }) | null;
    parcels: DeliveryVisibilityParcel[]; events: DeliveryVisibilityEvent[];
    quotes: {
      id: string; courier: string; amountMinor: string; eta?: string; available: boolean;
      expiresAt: string; recommended?: boolean; recommendationReason?: string;
      quality?: { rating?: number | null; votes?: number };
    }[];
  } | null;
};

export type AdminOrderCommand = "cancel-order" | "escrow" | "legacy-status" | "assign-shipment" |
  "quotes" | "select" | "refresh-quote" | "book" | "manual-dispatch" | "manual-status" |
  "reconcile" | "link" | "link-parcel" | "delivery-payment" | "cancel-delivery";
