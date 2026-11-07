import { createHash } from "node:crypto";
import { type Prisma } from "@leetlogic/database";
import { safeTrackingUrl } from "@leetlogic/contracts";
import { type TrackedShipment } from "../providers/shipping/shipbubble.js";
import { normalizeDeliveryStatus } from "./delivery-policy.js";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/** Store only documented tracking/contact fields, never raw provider responses or rider coordinates. */
export async function recordProviderTracking(
  tx: Prisma.TransactionClient,
  deliveryId: string,
  tracked: TrackedShipment,
  parcelIndex?: number,
) {
  const scope = { providerShipmentId: tracked.id, ...(parcelIndex === undefined ? {} : { parcelIndex }) };
  if (tracked.courierContact !== undefined || tracked.rider !== undefined) {
    const contact = {
      ...scope,
      courier: { name: text(tracked.courierContact?.name || tracked.courier, 160), phone: text(tracked.courierContact?.phone, 40) },
      rider: tracked.rider ? { name: text(tracked.rider.name, 160), phone: text(tracked.rider.phone, 40) } : null,
    };
    const latest = await tx.deliveryEvent.findFirst({
      where: { deliveryId, status: "PROVIDER_CONTACT_UPDATED", details: { path: ["providerShipmentId"], equals: tracked.id } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    // Compare structurally: PostgreSQL JSONB does not preserve object-key order.
    const previous = latest?.details as typeof contact | undefined;
    if (!previous || previous.courier?.name !== contact.courier.name || previous.courier?.phone !== contact.courier.phone ||
      previous.rider?.name !== contact.rider?.name || previous.rider?.phone !== contact.rider?.phone) {
      await tx.deliveryEvent.create({ data: {
        deliveryId, status: "PROVIDER_CONTACT_UPDATED", source: "shipbubble",
        dedupeKey: `${deliveryId}:contacts:${hash({ previous: latest?.id || null, contact })}`,
        details: contact,
      } });
    }
  }
  // Historical updates are audit data, not transitions or new receipt permissions. No push flood on backfill.
  for (const update of (tracked.updates || []).slice(-200)) {
    const status = text(update.status, 160), datetime = text(update.datetime, 80);
    if (!status || !datetime) continue;
    const details = {
      ...scope, providerStatus: status, providerTime: datetime,
      normalizedStatus: normalizeDeliveryStatus(status) || null,
    };
    await tx.deliveryEvent.upsert({
      where: { dedupeKey: `${deliveryId}:tracking:${hash(details)}` },
      create: { deliveryId, status: "PROVIDER_UPDATE", source: "shipbubble", dedupeKey: `${deliveryId}:tracking:${hash(details)}`, details },
      update: {},
    });
  }
}

export const trackedUrl = (tracked: TrackedShipment) => safeTrackingUrl(tracked.trackingUrl) || undefined;
