import { createHash } from "node:crypto";
import type { Address, Delivery, DeliveryQuote, PaymentAttempt, Prisma } from "@leetlogic/database";
import { addressInstructions, addressText, normalizeNigerianState } from "@leetlogic/contracts";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import {
  contactSchema,
  parcelSchema,
  assertShippingParcel,
  splitParts,
  type Contact,
} from "../providers/shipping/shipbubble.js";
import { deliveryQuoteConfiguration } from "./delivery-configuration.js";
import { orderShipping, packageSuggestion } from "./packaging.js";

export const shippingOrderInclude = {
  buyer: { include: { addresses: { where: { deletedAt: null } } } },
  listing: { include: { locationAddress: true } },
  farmerProfile: {
    include: { user: { include: { profile: true, addresses: { where: { deletedAt: null } } } } },
  },
} as const satisfies Prisma.TradeOrderInclude;
export type ShippingOrder = Prisma.TradeOrderGetPayload<{ include: typeof shippingOrderInclude }> & {
  delivery?: Delivery | null;
};
export type DeliveryInput = {
  pickup: Contact;
  destination: Contact;
  parcel: ReturnType<typeof parcelSchema.parse>;
};
export type CheckoutOrder = ShippingOrder & {
  delivery: (Delivery & { quotes: DeliveryQuote[] }) | null;
  settlementStarted?: boolean;
};
const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// JSONB changes object-key order. A quote fingerprint must not depend on that order.
const fingerprint = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
          : item,
      ),
    )
    .digest("hex");

export function savedAddressLocation(address: Address) {
  if (address.line1 === "Farm location pending full address")
    throw new AppError(422, "PICKUP_ADDRESS_REQUIRED", "Confirm the full street address as well as any map pin before requesting delivery.");
  const instructions = addressInstructions(address);
  return {
    addressId: address.id,
    address: addressText(address), state: normalizeNigerianState(address.state) || address.state,
    ...(address.postalCode ? { postalCode: address.postalCode } : {}),
    ...(instructions ? { instructions } : {}),
    ...(address.latitude != null && address.longitude != null
      ? { latitude: Number(address.latitude), longitude: Number(address.longitude) } : {}),
  };
}
export function savedPickupAddress(order: ShippingOrder): Address {
  const snapshot = order.delivery?.pickup as Partial<Contact> | null;
  const listingAddress = order.listing.locationAddress;
  const addresses = [listingAddress, ...order.farmerProfile.user.addresses].filter(
    (address) => !address.deletedAt && address.userId === order.farmerProfile.userId && address.countryCode === "NG",
  );
  // Historical quotes may contain a buyer address in pickup. Resolve farmer-owned addresses only.
  const saved = snapshot?.addressId ? addresses.find((address) => address.id === snapshot.addressId)
    : snapshot?.address && snapshot.state
    ? addresses.find(
        (address) =>
           normalizeNigerianState(address.state) === normalizeNigerianState(snapshot.state!) &&
          [address.line1, `${address.line1}, ${address.city}`, `${address.line1}, ${address.city}, ${address.lga}`]
            .some((text) => normalize(text) === normalize(snapshot.address!)),
      )
    : null;
  const defaultAddress = addresses.find((address) => address.id === listingAddress.id);
  if ((snapshot?.addressId && !saved) || (!saved && !defaultAddress))
    throw new AppError(422, "PICKUP_ADDRESS_REQUIRED", "The farmer must confirm a saved pickup address before delivery can be quoted.");
  return saved || defaultAddress!;
}
export function savedPickup(order: ShippingOrder) {
  return savedAddressLocation(savedPickupAddress(order));
}

export function checkPickup(order: ShippingOrder, pickup: Pick<Contact, "address" | "state" | "addressId">) {
  const expected = savedPickup(order);
  const listing = order.listing.locationAddress;
  const fullListingAddress = [listing.line1, listing.city, listing.lga].filter(Boolean).join(", ");
  const matches = normalize(pickup.address) === normalize(expected.address) ||
    // Older clients sent the listing's street without city or local government.
    (normalize(expected.address) === normalize(fullListingAddress) &&
      normalize(pickup.address) === normalize(listing.line1));
  if (!matches || normalizeNigerianState(pickup.state) !== expected.state ||
    (pickup.addressId && pickup.addressId !== expected.addressId))
    throw new AppError(422, "PICKUP_ADDRESS_MISMATCH", "Pickup changed. Refresh to use the farmer’s saved pickup address.");
}

/** Buyers supply the destination and date, never the physical shipment requirements. */
export function deriveDeliveryInput(
  order: ShippingOrder,
  requested: { pickup: Contact; destination: Contact; pickupDate: string },
): DeliveryInput {
  const suggested = packageSuggestion(order.packagingSnapshot ?? order.listing.packaging, order.quantity);
  if (!suggested)
    throw new AppError(422, "PACKING_REQUIRED", "The farmer must complete shipping measurements before delivery is available. You can choose pickup instead.");
  checkPickup(order, requested.pickup);
  const confirmed = savedPickup(order);
  const farmer = order.farmerProfile.user;
  const requestedDestination = requested.destination;
  let destination = requestedDestination;
  if (requestedDestination.addressId) {
    const address = order.buyer.addresses.find((address) => address.id === requestedDestination.addressId &&
      address.userId === order.buyerId && address.countryCode === "NG" && !address.deletedAt);
    if (!address) throw new AppError(422, "DESTINATION_ADDRESS_REQUIRED", "Choose one of your saved delivery addresses, or enter the full address manually.");
    const saved = savedAddressLocation(address);
    if (normalize(requestedDestination.address) !== normalize(saved.address) ||
      normalizeNigerianState(requestedDestination.state) !== saved.state)
      throw new AppError(422, "DESTINATION_ADDRESS_MISMATCH", "Your saved address changed. Reload it and request a fresh delivery quote.");
    // Contact details remain editable; location, postcode, directions and pin are authoritative.
    destination = { name: requestedDestination.name, phone: requestedDestination.phone, email: requestedDestination.email, country: "NG", ...saved };
  }
  return {
    pickup: contactSchema.parse({
      name: farmer.profile?.fullName || order.farmerProfile.farmName,
      phone: farmer.phoneE164,
      email: farmer.profile?.email || requested.pickup.email,
      ...confirmed,
      country: "NG",
    }),
    destination: contactSchema.parse(destination),
    parcel: parcelSchema.parse({
      weightKg: suggested.weightKg,
      packageCount: suggested.packageCount,
      length: suggested.length,
      width: suggested.width,
      height: suggested.height,
      handling: suggested.handling,
      notes: [suggested.notes, suggested.pickupInstructions].filter(Boolean).join(" · "),
      pickupDate: requested.pickupDate,
    }),
  };
}

export function assertDeliveryInput(order: ShippingOrder, input: DeliveryInput, booking = false, allowPastDate = false) {
  const c = getConfig();
  if (!c.DELIVERY_ENABLED || !c.SHIPBUBBLE_API_KEY || (c.SHIPBUBBLE_MODE === "test" && !c.SHIPBUBBLE_TEST_KEY_CONFIRMED))
    throw new AppError(503, "DELIVERY_UNAVAILABLE", "Delivery quotes are not available right now. Choose pickup or try again later.");
  if (booking && ((c.SHIPBUBBLE_MODE === "live" && !c.DELIVERY_LIVE_BOOKINGS) ||
    (c.BACHS_MODE === "live") !== (c.SHIPBUBBLE_MODE === "live")))
    throw new AppError(503, "BOOKING_DISABLED", "Delivery booking is not available in this payment environment. Choose pickup or try again later.");
  const { categories } = deliveryQuoteConfiguration(c);
  const shipping = orderShipping(order.packagingSnapshot, order.listing);
  const suggested = packageSuggestion(order.packagingSnapshot ?? order.listing.packaging, order.quantity);
  if (!suggested) throw new AppError(422, "PACKING_REQUIRED", "The farmer must complete shipping measurements before delivery is available. You can choose pickup instead.");
  if (shipping.shippingScope === "LOCAL" && normalizeNigerianState(input.pickup.state) !== normalizeNigerianState(input.destination.state))
    throw new AppError(422, "DELIVERY_SCOPE_UNSUPPORTED", "This farmer offers delivery within their state. Choose a delivery address in the same state.");
  if (suggested.specialHandling.length) {
    const error = new AppError(422, "SHIPMENT_HANDLING_UNSUPPORTED", "No integrated delivery service can confirm these special handling requirements. Choose pickup or contact support for suitable transport.");
    error.diagnostics = { provider: "shipbubble", operation: "shipment-eligibility", reason: `Unsupported handling flags: ${suggested.specialHandling.join(", ")}`, hint: "Do not downgrade the saved farmer packing requirements to STANDARD." };
    throw error;
  }
  if (!categories.includes(shipping.categoryId)) {
    const error = new AppError(422, "DELIVERY_COMMODITY_UNSUPPORTED", "Automatic courier delivery is not enabled for this produce category. Choose pickup or contact support to check carrier commodity coverage.");
    error.diagnostics = { provider: "shipbubble", operation: "shipment-eligibility", reason: `Product category ${shipping.categoryId} is not in DELIVERY_ALLOWED_CATEGORIES`, hint: "Confirm this commodity with the carrier, then configure its local category UUID. This is not a state or address rejection." };
    throw error;
  }
  assertShippingParcel(input.parcel, allowPastDate);
}

export function deliveryInputHash(order: ShippingOrder, input: DeliveryInput) {
  const shipping = orderShipping(order.packagingSnapshot, order.listing);
  const suggested = packageSuggestion(order.packagingSnapshot ?? order.listing.packaging, order.quantity);
  return fingerprint({
    ...input,
    orderId: order.id,
    quantity: order.quantity.toString(),
    valueMinor: order.totalMinor.toString(),
    name: order.listing.title,
    categoryId: shipping.categoryId,
    unitCode: shipping.unitCode,
    salePackaging: shipping.salePackaging ?? null,
    shippingScope: shipping.shippingScope,
    specialHandling: suggested?.specialHandling || [],
  });
}

export function storedDeliveryInput(delivery: Pick<Delivery, "pickup" | "destination" | "package">): DeliveryInput {
  return {
    pickup: contactSchema.parse(delivery.pickup),
    destination: contactSchema.parse(delivery.destination),
    parcel: parcelSchema.parse(delivery.package),
  };
}

/** Check both the persisted request and the immutable selling/packing basis before spending money. */
export function assertCurrentDeliveryQuote(
  order: ShippingOrder,
  delivery: Delivery,
  quote: DeliveryQuote | null | undefined,
  options: { selected?: boolean; booking?: boolean; allowExpired?: boolean; confirmationAt?: Date } = {},
) {
  if (!quote || quote.deliveryId !== delivery.id || (!options.allowExpired && quote.expiresAt <= (options.confirmationAt || new Date())))
    throw new AppError(409, "QUOTE_EXPIRED", "Choose a current delivery quote before paying.");
  const stale = () => new AppError(409, "STALE_DELIVERY_QUOTE", "Delivery details changed. Review a fresh delivery quote before paying.");
  if (!quote.courierId || !quote.requestToken || !quote.serviceCode || quote.amountMinor < 0n ||
    (quote.walletMinor !== null && quote.walletMinor < 0n) ||
    (options.selected !== false && (delivery.selectedQuoteId !== quote.id || delivery.shippingMinor !== quote.amountMinor || delivery.courier !== quote.courier)))
    throw stale();
  let input: DeliveryInput;
  try {
    input = storedDeliveryInput(delivery);
    const derived = deriveDeliveryInput({ ...order, delivery }, { ...input, pickupDate: input.parcel.pickupDate });
    if (fingerprint(input) !== fingerprint(derived) || quote.inputHash !== deliveryInputHash(order, derived)) throw stale();
    const parts = splitParts(quote.requestToken);
    if (input.parcel.packageCount === 1 ? !!parts : !parts || parts.length !== input.parcel.packageCount) throw stale();
    if (parts && (new Set(parts.map((part) => part.requestToken)).size !== parts.length ||
      parts.some((part) => part.requestToken.startsWith("split:")) ||
      parts.some((part) => part.courierId !== quote.courierId || part.serviceCode !== quote.serviceCode) ||
      parts.reduce((sum, part) => sum + BigInt(part.amountMinor), 0n) !== quote.amountMinor ||
      parts.reduce((sum, part) => sum + BigInt(part.walletMinor), 0n) !== (quote.walletMinor ?? quote.amountMinor))) throw stale();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw stale();
  }
  // Confirmation checks the saved shipment at the authoritative payment time, not today's
  // provider availability. Current eligibility and expiry are checked again before booking.
  if (!options.confirmationAt) assertDeliveryInput(order, input, options.booking, options.allowExpired);
  return quote;
}

export function assertCheckoutReady(order: CheckoutOrder, kind?: string, confirmationAt?: Date) {
  const d = order.delivery;
  const topup = order.status === "FUNDED" && d?.status === "TOPUP_REQUIRED";
  if (order.financialHold || order.settlementStarted || (order.status !== "AWAITING_PAYMENT" && !topup) ||
    (topup ? order.heldMinor !== order.totalMinor : order.heldMinor !== 0n) ||
    (kind && kind !== (topup ? "DELIVERY_TOPUP" : "ORDER")) || d?.providerShipmentId || d?.bookingStartedAt)
    throw new AppError(409, "PAYMENT_LOCKED", "This order cannot accept a payment right now.");
  if (!topup && order.reservationExpiresAt && order.reservationExpiresAt <= (confirmationAt || new Date()))
    throw new AppError(409, "ORDER_EXPIRED", "This order expired. Please place a new order.");
  const collection = d?.status === "PICKUP_PENDING" && !d.selectedQuoteId && d.shippingMinor === 0n && d.paidMinor === 0n;
  let quote: DeliveryQuote | null = null;
  if (!collection) {
    if (!d || (topup ? d.status !== "TOPUP_REQUIRED" : d.status !== "PAYMENT_PENDING" || d.paidMinor !== 0n))
      throw new AppError(409, "QUOTE_EXPIRED", "Choose a current delivery quote before paying.");
    quote = assertCurrentDeliveryQuote(order, d, d.quotes.find((item) => item.id === d.selectedQuoteId), { booking: true, confirmationAt });
  }
  const produceMinor = topup ? 0n : order.totalMinor;
  const shippingMinor = collection ? 0n : topup ? quote!.amountMinor - d!.paidMinor : quote!.amountMinor;
  const payableMinor = produceMinor + shippingMinor;
  if (shippingMinor < 0n || payableMinor <= 0n)
    throw new AppError(409, "TOPUP_NOT_REQUIRED", "No additional payment is needed.");
  return { payableMinor, produceMinor, shippingMinor, quote, quoteExpiresAt: quote?.expiresAt ?? null };
}

export async function assertNoActiveCheckout(tx: Prisma.TransactionClient, orderId: string) {
  if (await tx.paymentAttempt.count({ where: { orderId, OR: [
    { status: { in: ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"] } },
    { status: "BLOCKED", checkoutId: { not: null } },
  ] } })) throw new AppError(409, "CHECKOUT_ACTIVE", "Finish the current payment before changing delivery details.");
}

export function checkoutSummary(order: CheckoutOrder) {
  try {
    const { payableMinor, quoteExpiresAt } = assertCheckoutReady(order);
    return {
      checkoutReady: true,
      payableMinor,
      totalWithDeliveryMinor: order.totalMinor + (order.delivery?.shippingMinor ?? 0n),
      quoteExpiresAt,
      checkoutErrorCode: null,
    };
  } catch (error) {
    return {
      checkoutReady: false,
      payableMinor: null,
      // A funded order may show its recorded price, but it is never a payable amount.
      totalWithDeliveryMinor: order.status !== "AWAITING_PAYMENT" && order.delivery &&
        (order.delivery.selectedQuoteId || ["PICKUP_READY", "DELIVERED"].includes(order.delivery.status))
        ? order.totalMinor + order.delivery.shippingMinor : null,
      quoteExpiresAt: null,
      checkoutErrorCode: error instanceof AppError ? error.code : "STALE_DELIVERY_QUOTE",
    };
  }
}

export function assertPaymentShipment(
  order: CheckoutOrder,
  payment: PaymentAttempt,
  confirmationAt?: Date,
) {
  const current = assertCheckoutReady(order, payment.kind, confirmationAt);
  if (payment.expiresAt <= (confirmationAt || new Date())) throw new AppError(409, "QUOTE_EXPIRED", "Refresh your delivery quote before paying.");
  if (current.payableMinor !== payment.amountMinor || payment.orderId !== order.id || payment.buyerId !== order.buyerId ||
    payment.produceMinor !== current.produceMinor || payment.shippingMinor !== current.shippingMinor ||
    payment.quoteId !== (current.quote?.id ?? null))
    throw new AppError(409, "STALE_DELIVERY_QUOTE", "Delivery details changed. Review a fresh delivery quote before paying.");
}
