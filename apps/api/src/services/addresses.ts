import { createHash, randomUUID } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";
import { prisma, type Address, type Prisma } from "@leetlogic/database";
import type { AddressInput } from "@leetlogic/contracts";
import { AppError } from "../lib/errors.js";
import { assertNoActiveCheckout, savedPickupAddress, shippingOrderInclude, type ShippingOrder } from "./delivery-quote.js";
import { confirmedPostcode, uncheckedPostcode } from "./postcode-verification.js";
import { audit } from "./audit.js";

const locationKeys = ["state", "lga", "city", "line1", "line2", "landmark", "postalCode"] as const;
/** Owner gates cover newly attached addresses and serialize changes to default-address flags. */
export async function lockAddressOwners(tx: Prisma.TransactionClient, userIds: string[]) {
  for (const id of [...new Set(userIds)].sort())
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`address-owner:${id}`}, 0))`;
}
/** Lock before the order when a saved address is newly attached to a quotation. */
export async function lockDeliveryRequestAddresses(tx: Prisma.TransactionClient, order: ShippingOrder, destinationId?: string, pickupId?: string) {
  await lockAddressOwners(tx, [order.buyerId, order.farmerProfile.userId]);
  const snapshotId = z.string().uuid().safeParse((order.delivery?.pickup as { addressId?: unknown } | null)?.addressId);
  const ids = [...new Set([order.listing.locationAddressId, snapshotId.success ? snapshotId.data : undefined, destinationId, pickupId].filter((id): id is string => !!id))].sort();
  for (const id of ids) await tx.$queryRaw`SELECT id FROM addresses WHERE id = ${id}::uuid FOR UPDATE`;
}
function locationChanged(address: Address, body: AddressInput) {
  return locationKeys.some((key) => body[key] !== undefined && (body[key] || null) !== (address[key] || null)) ||
    (body.coordinates !== undefined && (
      (body.coordinates?.latitude ?? null) !== (address.latitude == null ? null : Number(address.latitude)) ||
      (body.coordinates?.longitude ?? null) !== (address.longitude == null ? null : Number(address.longitude))
    ));
}
/** Serialize location changes with quote/payment writes; never redirect an in-flight paid shipment. */
export async function guardAddressChange(tx: Prisma.TransactionClient, addressId: string) {
  const orders = await tx.tradeOrder.findMany({
    where: {
      status: { notIn: ["CANCELLED", "RELEASED", "REFUNDED", "COMPLETED"] },
      OR: [
        { listing: { locationAddressId: addressId } },
        { delivery: { pickup: { path: ["addressId"], equals: addressId } } },
        { delivery: { destination: { path: ["addressId"], equals: addressId } } },
      ],
    }, select: { id: true }, orderBy: { id: "asc" },
  });
  for (const { id } of orders) {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${id}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id }, include: { ...shippingOrderInclude, delivery: true, shipment: true } });
    if (["CANCELLED", "RELEASED", "REFUNDED", "COMPLETED"].includes(order.status)) continue;
    // A paid order with a different explicitly saved pickup does not use the listing's farm address.
    if (order.listing.locationAddressId === addressId &&
      (order.delivery?.destination as { addressId?: string } | null)?.addressId !== addressId &&
      savedPickupAddress(order).id !== addressId) continue;
    await assertNoActiveCheckout(tx, id);
    if (order.status !== "AWAITING_PAYMENT" || order.financialHold || order.shipment || order.delivery?.providerShipmentId || order.delivery?.bookingStartedAt || order.delivery?.paidMinor)
      throw new AppError(409, "ADDRESS_IN_USE", "This address is in use for a paid delivery. Save a new address instead, or wait until the order is completed.");
    const delivery = order.delivery;
    if (!delivery) continue;
    await tx.deliveryQuote.updateMany({ where: { deliveryId: delivery.id }, data: { expiresAt: new Date() } });
    // Also invalidate provider responses that are still in flight.
    await tx.delivery.update({ where: { id: delivery.id }, data: {
      status: delivery.status === "PICKUP_PENDING" ? "PICKUP_PENDING" : "QUOTE_REQUIRED",
      selectedQuoteId: null, shippingMinor: 0n, courier: null, failureCode: "STALE_DELIVERY_QUOTE",
      ...(delivery.package && typeof delivery.package === "object" && !Array.isArray(delivery.package)
        ? { package: { ...delivery.package, quoteRequestId: randomUUID() } } : {}),
    } });
  }
}
export async function saveCustomerAddress(userId: string, body: AddressInput, id?: string, request?: Request) {
  const key = !id && request?.header("Idempotency-Key");
  const idempotencyKey = key ? z.string().uuid().parse(key) : undefined;
  const scope = `address:${userId}`;
  const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return prisma.$transaction(async (tx) => {
    await lockAddressOwners(tx, [userId]);
    if (idempotencyKey) {
      const prior = await tx.idempotencyRecord.findUnique({ where: { scope_idempotencyKey: { scope, idempotencyKey } } });
      if (prior) {
        if (prior.requestHash !== requestHash) throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "The address changed. Start a new save request.");
        const saved = prior.resourceId && await tx.address.findFirst({ where: { id: prior.resourceId, userId, deletedAt: null } });
        if (!saved) throw new AppError(409, "ADDRESS_NOT_FOUND", "The saved address is no longer available. Reload your addresses.");
        return saved;
      }
    }
    let existing: Address | null = null;
    if (id) {
      await tx.$queryRaw`SELECT id FROM addresses WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
      existing = await tx.address.findFirst({ where: { id, userId, deletedAt: null, countryCode: "NG" } });
      if (!existing) throw new AppError(404, "ADDRESS_NOT_FOUND", "Your saved address could not be found.");
    }
    const changed = existing ? locationChanged(existing, body) : true;
    if (existing && changed) await guardAddressChange(tx, existing.id);
    const verified = body.verificationToken ? confirmedPostcode(userId, body)
      : changed || body.verificationToken === null ? uncheckedPostcode : {};
    const { coordinates, verificationToken: _token, ...fields } = body;
    void _token;
    if (body.isDefaultDelivery)
      await tx.address.updateMany({ where: { userId, deletedAt: null, isDefaultDelivery: true }, data: { isDefaultDelivery: false } });
    const geographicChange = existing && ["state", "lga", "city", "line1", "postalCode"].some((key) =>
      body[key as keyof AddressInput] !== undefined && body[key as keyof AddressInput] !== existing[key as keyof Address]);
    const data = { ...fields, ...verified,
      ...(coordinates !== undefined || geographicChange ? { latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null } : {}),
    };
    const saved = existing ? await tx.address.update({ where: { id: existing.id }, data })
      : await tx.address.create({ data: { ...data, userId, countryCode: "NG" } });
    if (request) await audit(request, { action: existing ? "address.updated" : "address.created", entityType: "address", entityId: saved.id }, tx);
    if (idempotencyKey) await tx.idempotencyRecord.create({ data: {
      scope, idempotencyKey, requestHash, resourceId: saved.id, responseStatus: 201,
      responseBody: { addressId: saved.id }, completedAt: new Date(), expiresAt: new Date(Date.now() + 86400000),
    } });
    return saved;
  });
}
