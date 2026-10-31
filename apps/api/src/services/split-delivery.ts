import { prisma, type DeliveryParcel, type Prisma } from "@leetlogic/database";
import {
  splitParts,
  type Shipbubble,
  type TrackedShipment,
} from "../providers/shipping/shipbubble.js";
import { canAdvanceDelivery, normalizeDeliveryStatus } from "./delivery-policy.js";

type SplitQuote = { id: string; requestToken: string; courier: string };
export function splitPlanMatches(quote: SplitQuote, parcels: DeliveryParcel[]) {
  const parts = splitParts(quote.requestToken);
  return !!parts && parcels.length === parts.length &&
    new Set(parcels.map((parcel) => parcel.parcelIndex)).size === parts.length &&
    parcels.every((parcel) => {
      const part = parts[parcel.parcelIndex];
      return !!part && parcel.quoteId === quote.id && parcel.requestToken === part.requestToken &&
        parcel.courierId === part.courierId && parcel.serviceCode === part.serviceCode &&
        parcel.amountMinor === BigInt(part.amountMinor) && parcel.walletMinor === BigInt(part.walletMinor);
    });
}

/** Only a complete, matching recorded plan can bypass an expired quote for local accounting. */
export function recordedSplitBooking(deliveryId: string, quote: SplitQuote, parcels: DeliveryParcel[]): TrackedShipment | null {
  if (!splitPlanMatches(quote, parcels) || parcels.some((parcel) => !parcel.providerShipmentId)) return null;
  return {
    id: `split:${deliveryId}`,
    status: "pending",
    courier: quote.courier,
    shippingMinor: parcels.every((parcel) => parcel.actualMinor !== null)
      ? parcels.reduce((sum, parcel) => sum + parcel.actualMinor!, 0n)
      : undefined,
    requiresReview: parcels.some((parcel) => parcel.failureCode === "SHIPMENT_MISMATCH" ||
      (parcel.actualMinor !== null && parcel.actualMinor !== parcel.walletMinor)),
  };
}

/** Persist each outbound booking BEFORE making the provider call; never replay an ambiguous call. */
export async function bookSplitDelivery(
  provider: Shipbubble,
  deliveryId: string,
  quote: SplitQuote,
  beforeBook?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<TrackedShipment | null> {
  const parts = splitParts(quote.requestToken);
  if (!parts) return null;
  await prisma.$transaction(async (tx) => {
    for (const [parcelIndex, part] of parts.entries())
      await tx.deliveryParcel.upsert({
        where: { deliveryId_parcelIndex: { deliveryId, parcelIndex } },
        create: {
          deliveryId,
          quoteId: quote.id,
          parcelIndex,
          ...part,
          amountMinor: BigInt(part.amountMinor),
          walletMinor: BigInt(part.walletMinor),
        },
        update: {},
      });
    await tx.delivery.update({
      where: { id: deliveryId },
      data: { providerShipmentId: `split:${deliveryId}` },
    });
  });
  const pending = await prisma.deliveryParcel.findMany({
    where: { deliveryId },
    orderBy: { parcelIndex: "asc" },
  });
  if (!splitPlanMatches(quote, pending)) throw new Error("SPLIT_QUOTE_CHANGED");
  for (const parcel of pending) {
    if (parcel.providerShipmentId) continue;
    const claimed = await prisma.$transaction(async (tx) => {
      await beforeBook?.(tx);
      return tx.deliveryParcel.updateMany({
        where: { id: parcel.id, status: "PENDING", providerShipmentId: null },
        data: { status: "BOOKING" },
      });
    });
    if (!claimed.count) throw new Error("SPLIT_BOOKING_UNCERTAIN");
    try {
      const result = await provider.book(parcel);
      await prisma.deliveryParcel.update({
        where: { id: parcel.id },
        data: {
          providerShipmentId: result.id,
          trackingUrl: result.trackingUrl,
          actualMinor: result.shippingMinor,
          status: "BOOKED",
          // The label exists even if the courier differs. Keep it, but never hide the mismatch.
          failureCode: result.courier !== quote.courier ? "SHIPMENT_MISMATCH" : null,
        },
      });
    } catch (error) {
      await prisma.deliveryParcel.update({
        where: { id: parcel.id },
        data: { status: "BOOKING_UNCERTAIN", failureCode: "BOOKING_RESULT_UNKNOWN" },
      });
      throw error;
    }
  }
  const parcels = await prisma.deliveryParcel.findMany({ where: { deliveryId } });
  const result = recordedSplitBooking(deliveryId, quote, parcels);
  if (!result) throw new Error("SPLIT_BOOKING_UNCERTAIN");
  return result;
}
export function aggregateParcelStatus(statuses: string[]): string {
  if (!statuses.length) return "pending";
  if (statuses.every((status) => status === "DELIVERED")) return "delivered";
  if (statuses.every((status) => status === "CANCELLED")) return "cancelled";
  if (statuses.every((status) => status === "RETURNED")) return "returned";
  if (statuses.some((status) => ["RETURNED", "RETURNING"].includes(status))) return "returning";
  // A mixed terminal result needs reconciliation; never claim the whole order was delivered.
  if (statuses.some((status) => ["CANCELLED", "RETURNED", "RETURNING"].includes(status)))
    return "failed_attempt";
  if (statuses.every((status) => ["IN_TRANSIT", "DELIVERED", "FAILED_ATTEMPT"].includes(status)))
    return "in_transit";
  if (
    statuses.every((status) =>
      ["PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED_ATTEMPT"].includes(status),
    )
  )
    return "picked_up";
  return "pending";
}
export async function trackSplitDelivery(
  provider: Shipbubble,
  deliveryId: string,
  cancel = false,
): Promise<TrackedShipment> {
  const parcels = await prisma.deliveryParcel.findMany({
    where: { deliveryId },
    orderBy: { parcelIndex: "asc" },
  });
  if (!parcels.length) throw new Error("SPLIT_SHIPMENT_MISSING");
  const failures: unknown[] = [];
  for (const parcel of parcels) {
    if (!parcel.providerShipmentId) {
      // Cancel every known label even when another label still needs reconciliation.
      // An unrecorded label can never be treated as a confirmed cancellation.
      failures.push(new Error("SPLIT_BOOKING_UNCERTAIN"));
      continue;
    }
    if (
      cancel &&
      !parcel.cancelAttemptedAt &&
      !["CANCELLED", "RETURNED", "DELIVERED"].includes(parcel.status)
    ) {
      try {
        const claimed = await prisma.deliveryParcel.updateMany({
          where: { id: parcel.id, cancelAttemptedAt: null },
          data: { cancelAttemptedAt: new Date() },
        });
        if (claimed.count) await provider.cancel(parcel.providerShipmentId);
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      const tracked = await provider.track(parcel.providerShipmentId);
      if (tracked.id !== parcel.providerShipmentId) throw new Error("SHIPMENT_MISMATCH");
      const next = normalizeDeliveryStatus(tracked.status);
      await prisma.deliveryParcel.update({
        where: { id: parcel.id },
        data: {
          ...(next && canAdvanceDelivery(parcel.status, next) ? { status: next } : {}),
          trackingUrl: tracked.trackingUrl,
        },
      });
    } catch (error) {
      // A failed read or ambiguous cancellation must not prevent other labels being reconciled.
      failures.push(error);
    }
  }
  if (failures.length) throw failures[0];
  const current = await prisma.deliveryParcel.findMany({ where: { deliveryId } });
  if (current.some((parcel) => !parcel.providerShipmentId)) throw new Error("SPLIT_BOOKING_UNCERTAIN");
  return {
    id: `split:${deliveryId}`,
    status: aggregateParcelStatus(current.map((parcel) => parcel.status)),
    courier: "",
    requiresReview: current.some((parcel) => ["CANCELLED", "RETURNED", "RETURNING"].includes(parcel.status)) &&
      !current.every((parcel) => parcel.status === "CANCELLED"),
  };
}
