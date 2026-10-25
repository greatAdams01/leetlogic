import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { requireAuth, requirePermission, requireRecentStepUp } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { getConfig } from "../config.js";
import { canAdvanceDelivery } from "../services/delivery-policy.js";
import { audit } from "../services/audit.js";
import { contactSchema, parcelSchema } from "../providers/shipping/shipbubble.js";
import { deliveryEvent, hashInput, serialize, shippingProvider } from "../services/delivery.js";
const uuid = z.string().uuid();
const quoteBody = z.object({
  pickup: contactSchema,
  destination: contactSchema,
  parcel: parcelSchema,
});
async function unlockedCheckout(tx: any, orderId: string) {
  if (
    await tx.paymentAttempt.count({
      where: { orderId, status: { in: ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"] } },
    })
  )
    throw new AppError(
      409,
      "CHECKOUT_ACTIVE",
      "Finish the current payment before changing delivery details.",
    );
}
function safeQuote(q: any) {
  return {
    id: q.id,
    courier: q.courier,
    amountMinor: q.amountMinor,
    eta: q.eta,
    expiresAt: q.expiresAt,
  };
}
export const customerDeliveryRouter = Router();
export const staffDeliveryRouter = Router();
export const deliveryWebhookRouter = Router();
customerDeliveryRouter.use(requireAuth("customer"));
staffDeliveryRouter.use(requireAuth("admin"), requirePermission("orders.read"));
async function orderAccess(req: Request) {
  const orderId = uuid.parse(req.params.id);
  const order = await prisma.tradeOrder.findUnique({
    where: { id: orderId },
    include: {
      farmerProfile: { include: { user: { include: { profile: true } } } },
      listing: { include: { locationAddress: true } },
      shipment: true,
      delivery: {
        include: {
          quotes: { orderBy: { createdAt: "desc" }, take: 30 },
          events: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (
    !order ||
    (req.auth!.subject !== "admin" &&
      order.buyerId !== req.auth!.sub &&
      order.farmerProfile.userId !== req.auth!.sub)
  )
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  return order;
}
customerDeliveryRouter.get("/notifications", async (req, res) => {
  const items = await prisma.deliveryNotification.findMany({
    where: { userId: req.auth!.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ items });
});
customerDeliveryRouter.get("/", async (req, res) => {
  const { view } = z.object({ view: z.enum(["buyer", "seller"]).optional() }).parse(req.query);
  const items = await prisma.tradeOrder.findMany({
    where:
      view === "seller"
        ? { farmerProfile: { userId: req.auth!.sub } }
        : view === "buyer"
          ? { buyerId: req.auth!.sub }
          : { OR: [{ buyerId: req.auth!.sub }, { farmerProfile: { userId: req.auth!.sub } }] },
    select: {
      id: true,
      reference: true,
      status: true,
      totalMinor: true,
      quantity: true,
      listing: { select: { title: true, unitCode: true } },
      delivery: { select: { status: true, shippingMinor: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(serialize({ items }));
});
// Only the farmer can change where their produce is collected, before checkout.
customerDeliveryRouter.post("/:id/delivery/pickup", async (req, res) => {
  const order = await orderAccess(req);
  if (order.farmerProfile.userId !== req.auth!.sub)
    throw new AppError(403, "FARMER_REQUIRED", "Only the farmer can change the pickup address.");
  const { addressId } = z.object({ addressId: uuid }).strict().parse(req.body);
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: req.auth!.sub, deletedAt: null, countryCode: "NG" },
  });
  if (!address) throw new AppError(422, "INVALID_ADDRESS", "Choose one of your saved addresses.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
    await unlockedCheckout(tx, order.id);
    const current = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true, shipment: true },
    });
    if (current.status !== "AWAITING_PAYMENT" || current.shipment || current.delivery?.paidMinor)
      throw new AppError(409, "DELIVERY_LOCKED", "Pickup cannot change after payment or dispatch.");
    const pickup = {
      name: order.farmerProfile.user.profile?.fullName || order.farmerProfile.farmName,
      phone: order.farmerProfile.user.phoneE164,
      email: order.farmerProfile.user.profile?.email || "",
      address: `${address.line1}, ${address.city}, ${address.lga}`,
      state: address.state,
      country: "NG",
      ...(address.latitude !== null && address.longitude !== null
        ? { latitude: Number(address.latitude), longitude: Number(address.longitude) }
        : {}),
    };
    const delivery = await tx.delivery.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, pickup },
      update: {
        pickup,
        selectedQuoteId: null,
        shippingMinor: 0n,
        courier: null,
        failureCode: null,
        status: "QUOTE_REQUIRED",
      },
    });
    await tx.deliveryQuote.deleteMany({ where: { deliveryId: delivery.id } });
    await deliveryEvent(
      tx,
      delivery.id,
      "QUOTE_REQUIRED",
      "customer",
      `${delivery.id}:pickup:${hashInput(pickup)}:${Date.now()}`,
      req.auth!.sub,
    );
    await audit(
      req,
      { action: "delivery.pickup.updated", entityType: "order", entityId: order.id },
      tx,
    );
  });
  res.json({ saved: true });
});
function savedPickup(order: any) {
  const pickup = order.delivery?.pickup;
  return pickup && typeof pickup.address === "string" && typeof pickup.state === "string"
    ? pickup
    : {
        address: order.listing.locationAddress.line1,
        state: order.listing.locationAddress.state,
        ...(order.listing.locationAddress.latitude != null &&
        order.listing.locationAddress.longitude != null
          ? {
              latitude: Number(order.listing.locationAddress.latitude),
              longitude: Number(order.listing.locationAddress.longitude),
            }
          : {}),
      };
}
function checkPickup(order: any, pickup: { address: string; state: string }) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const expected = savedPickup(order);
  if (
    !normalize(pickup.address).includes(normalize(expected.address)) ||
    pickup.state.toLowerCase() !== expected.state.toLowerCase()
  )
    throw new AppError(
      422,
      "PICKUP_ADDRESS_MISMATCH",
      "Pickup changed. Refresh to use the farmer’s saved pickup address.",
    );
}
for (const router of [customerDeliveryRouter, staffDeliveryRouter]) {
  router.get("/:id/delivery", async (req, res) => {
    const order = await orderAccess(req);
    const delivery = order.delivery;
    res.json(
      serialize({
        order: {
          id: order.id,
          reference: order.reference,
          status: order.status,
          title: order.listing.title,
          description: order.listing.description,
          listingId: order.listing.id,
          totalMinor: order.totalMinor,
          isBuyer: order.buyerId === req.auth!.sub,
          suggestedPickup: {
            name: order.farmerProfile.user.profile?.fullName || order.farmerProfile.farmName,
            phone: order.farmerProfile.user.phoneE164,
            email: order.farmerProfile.user.profile?.email || "",
            address: savedPickup(order).address,
            state: savedPickup(order).state,
            ...(savedPickup(order).latitude != null && savedPickup(order).longitude != null
              ? { latitude: savedPickup(order).latitude, longitude: savedPickup(order).longitude }
              : {}),
          },
        },
        delivery: delivery ? { ...delivery, quotes: delivery.quotes.map(safeQuote) } : null,
      }),
    );
  });
  router.post("/:id/delivery/quotes", async (req, res) => {
    const order = await orderAccess(req);
    const body = quoteBody.parse(req.body);
    const c = getConfig();
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can choose delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    if (order.status !== "AWAITING_PAYMENT" || order.shipment || order.delivery?.paidMinor)
      throw new AppError(
        409,
        "DELIVERY_LOCKED",
        "Delivery details cannot be changed after payment or dispatch",
      );
    if (!c.DELIVERY_ENABLED)
      throw new AppError(503, "DELIVERY_UNAVAILABLE", "Delivery quotes are not available yet");
    checkPickup(order, body.pickup);
    const confirmed = savedPickup(order);
    delete body.pickup.latitude;
    delete body.pickup.longitude;
    if (confirmed.latitude != null && confirmed.longitude != null) {
      body.pickup.latitude = Number(confirmed.latitude);
      body.pickup.longitude = Number(confirmed.longitude);
    }
    if (
      order.listing.shippingScope === "LOCAL" &&
      body.pickup.state.toLowerCase() !== body.destination.state.toLowerCase()
    )
      throw new AppError(
        422,
        "DELIVERY_SCOPE_UNSUPPORTED",
        "This farmer offers delivery within their state. Choose a delivery address in the same state.",
      );
    const categories = c.DELIVERY_ALLOWED_CATEGORIES.split(",");
    const states = c.DELIVERY_ALLOWED_STATES.toLowerCase()
      .split(",")
      .map((x) => x.trim());
    const eligible =
      body.parcel.handling === "STANDARD" &&
      body.parcel.weightKg <= c.DELIVERY_MAX_WEIGHT_KG &&
      categories.includes(order.listing.categoryId) &&
      states.includes(body.pickup.state.toLowerCase()) &&
      states.includes(body.destination.state.toLowerCase());
    if (
      body.parcel.pickupDate < new Date().toISOString().slice(0, 10) ||
      Number.isNaN(Date.parse(body.parcel.pickupDate))
    )
      throw new AppError(422, "INVALID_PICKUP_DATE", "Choose a valid future pickup date");
    if (!eligible) {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
        await unlockedCheckout(tx, order.id);
        const current = await tx.tradeOrder.findUniqueOrThrow({
          where: { id: order.id },
          include: { delivery: true, shipment: true },
        });
        if (
          current.status !== "AWAITING_PAYMENT" ||
          current.shipment ||
          current.delivery?.paidMinor
        )
          throw new AppError(409, "DELIVERY_LOCKED", "Order changed; refresh and retry");
        checkPickup({ ...order, delivery: current.delivery }, body.pickup);
        const d = await tx.delivery.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            status: "MANUAL_REVIEW",
            pickup: body.pickup,
            destination: body.destination,
            package: body.parcel,
          },
          update: {
            status: "MANUAL_REVIEW",
            pickup: body.pickup,
            destination: body.destination,
            package: body.parcel,
          },
        });
        await deliveryEvent(
          tx,
          d.id,
          "MANUAL_REVIEW",
          "customer",
          `${d.id}:manual:${hashInput(body)}`,
          req.auth!.sub,
        );
        await audit(
          req,
          { action: "delivery.manual.requested", entityType: "order", entityId: order.id },
          tx,
        );
      });
      res.status(202).json({
        manualReview: true,
        message: "This delivery requires staff review; no courier booking has been made.",
      });
      return;
    }
    const rates = await shippingProvider.quotes({
      ...body,
      name: order.listing.title,
      valueMinor: order.totalMinor,
    });
    const items = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { delivery: true, shipment: true },
      });
      if (current.status !== "AWAITING_PAYMENT" || current.shipment || current.delivery?.paidMinor)
        throw new AppError(409, "DELIVERY_LOCKED", "Order changed; refresh and retry");
      checkPickup({ ...order, delivery: current.delivery }, body.pickup);
      const d = await tx.delivery.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          pickup: body.pickup,
          destination: body.destination,
          package: body.parcel,
          status: rates.length ? "QUOTE_REQUIRED" : "MANUAL_REVIEW",
        },
        update: {
          pickup: body.pickup,
          destination: body.destination,
          package: body.parcel,
          selectedQuoteId: null,
          shippingMinor: 0,
          status: rates.length ? "QUOTE_REQUIRED" : "MANUAL_REVIEW",
        },
      });
      await tx.deliveryQuote.updateMany({
        where: { deliveryId: d.id },
        data: { expiresAt: new Date() },
      });
      const result = [];
      for (const rate of rates)
        result.push(
          await tx.deliveryQuote.create({
            data: {
              deliveryId: d.id,
              ...rate,
              inputHash: hashInput(body),
              expiresAt: new Date(Date.now() + 15 * 60000),
            },
          }),
        );
      await deliveryEvent(
        tx,
        d.id,
        rates.length ? "QUOTE_REQUIRED" : "MANUAL_REVIEW",
        "system",
        `${d.id}:quoted:${hashInput(body)}:${Date.now()}`,
      );
      await audit(req, { action: "delivery.quoted", entityType: "order", entityId: order.id }, tx);
      return result;
    });
    res.json(serialize({ items: items.map(safeQuote) }));
  });
  router.post("/:id/delivery/select", async (req, res) => {
    const order = await orderAccess(req);
    const { quoteId } = z.object({ quoteId: uuid }).parse(req.body);
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can choose delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id } });
      const d = await tx.delivery.findUniqueOrThrow({ where: { orderId: order.id } });
      const quote = await tx.deliveryQuote.findUnique({ where: { id: quoteId } });
      if (
        current.status !== "AWAITING_PAYMENT" ||
        d.paidMinor ||
        !quote ||
        quote.deliveryId !== d.id ||
        quote.expiresAt <= new Date()
      )
        throw new AppError(409, "QUOTE_EXPIRED", "Request a fresh delivery quote before payment");
      await tx.delivery.update({
        where: { id: d.id },
        data: {
          selectedQuoteId: quote.id,
          shippingMinor: quote.amountMinor,
          courier: quote.courier,
          status: "PAYMENT_PENDING",
        },
      });
      await deliveryEvent(
        tx,
        d.id,
        "PAYMENT_PENDING",
        "customer",
        `${d.id}:selected:${quote.id}`,
        req.auth!.sub,
      );
      await audit(
        req,
        { action: "delivery.selected", entityType: "order", entityId: order.id },
        tx,
      );
    });
    res.json({ selected: true });
  });
  router.post("/:id/delivery/refresh-quote", async (req, res) => {
    const order = await orderAccess(req);
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can refresh delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    const d = order.delivery;
    if (
      !d ||
      !d.selectedQuoteId ||
      d.providerShipmentId ||
      d.bookingStartedAt ||
      !["AWAITING_PAYMENT", "FUNDED"].includes(order.status)
    )
      throw new AppError(409, "DELIVERY_LOCKED", "Delivery quote cannot be refreshed");
    const selected = await prisma.deliveryQuote.findUniqueOrThrow({
      where: { id: d.selectedQuoteId },
    });
    const pickup = contactSchema.parse(d.pickup),
      destination = contactSchema.parse(d.destination),
      parcel = parcelSchema.parse(d.package);
    const rates = await shippingProvider.quotes({
      pickup,
      destination,
      parcel,
      name: order.listing.title,
      valueMinor: order.totalMinor,
    });
    const rate = rates.find((x) => x.serviceCode === selected.serviceCode);
    if (
      !rate ||
      (d.paidMinor > 0n && d.paidMinor !== rate.amountMinor && order.fundsProvider !== "bachs")
    )
      throw new AppError(
        409,
        "DELIVERY_PRICE_CHANGED",
        "Courier availability or paid delivery price changed. Contact staff to reconcile payment before booking.",
      );
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.delivery.findUniqueOrThrow({ where: { id: d.id } });
      if (
        current.selectedQuoteId !== d.selectedQuoteId ||
        current.bookingStartedAt ||
        current.providerShipmentId ||
        current.paidMinor !== d.paidMinor
      )
        throw new AppError(409, "STALE_RECORD", "Delivery changed; refresh and retry");
      const quote = await tx.deliveryQuote.create({
        data: {
          deliveryId: d.id,
          ...rate,
          inputHash: selected.inputHash,
          expiresAt: new Date(Date.now() + 15 * 60000),
        },
      });
      await tx.delivery.update({
        where: { id: d.id },
        data: {
          selectedQuoteId: quote.id,
          shippingMinor: rate.amountMinor,
          status:
            d.paidMinor > 0n
              ? d.paidMinor < rate.amountMinor
                ? "TOPUP_REQUIRED"
                : "PAID"
              : "PAYMENT_PENDING",
          failureCode: null,
        },
      });
      await audit(
        req,
        { action: "delivery.quote.refreshed", entityType: "delivery", entityId: d.id },
        tx,
      );
    });
    await queueBooking(order.id).catch(() => {});
    res.json({ refreshed: true });
  });
  router.post("/:id/delivery/book", async (req, res) => {
    const order = await orderAccess(req);
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can book delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    await queueBooking(order.id);
    res.status(202).json({ queued: true });
  });
}
export async function queueBooking(orderId: string) {
  const c = getConfig();
  if (!c.DELIVERY_ENABLED || (c.SHIPBUBBLE_MODE === "live" && !c.DELIVERY_LIVE_BOOKINGS))
    throw new AppError(503, "BOOKING_DISABLED", "Delivery booking is disabled");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { delivery: true },
    });
    const d = order.delivery;
    if (!d) throw new AppError(409, "QUOTE_REQUIRED", "Choose delivery first");
    if (
      [
        "BOOKING_QUEUED",
        "BOOKING",
        "BOOKING_UNCERTAIN",
        "BOOKED",
        "PICKED_UP",
        "IN_TRANSIT",
        "DELIVERED",
      ].includes(d.status)
    )
      return;
    const quote = d.selectedQuoteId
      ? await tx.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } })
      : null;
    if (
      order.status !== "FUNDED" ||
      order.financialHold ||
      !quote ||
      quote.expiresAt <= new Date() ||
      d.paidMinor < quote.amountMinor
    )
      throw new AppError(
        409,
        "BOOKING_NOT_READY",
        "Fund the order and confirm payment for a current delivery quote",
      );
    await tx.delivery.update({
      where: { id: d.id },
      data: { status: "BOOKING_QUEUED", failureCode: null },
    });
    await deliveryEvent(tx, d.id, "BOOKING_QUEUED", "system", `${d.id}:queued:${quote.id}`);
  });
}
staffDeliveryRouter.post(
  "/:id/delivery/payment",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const order = await orderAccess(req);
    if (order.fundsProvider === "bachs")
      throw new AppError(
        409,
        "PROVIDER_PAYMENT_REQUIRED",
        "Delivery payment is confirmed by the payment provider.",
      );
    const body = z
      .object({
        amountMinor: z.string().regex(/^\d{1,12}$/),
        reference: z.string().trim().min(3).max(160),
      })
      .parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const d = await tx.delivery.findUniqueOrThrow({ where: { orderId: order.id } });
      if (d.paymentRef === body.reference && d.paidMinor === BigInt(body.amountMinor)) return;
      const quote = d.selectedQuoteId
        ? await tx.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } })
        : null;
      if (
        d.paymentRef ||
        !quote ||
        quote.expiresAt <= new Date() ||
        quote.amountMinor !== BigInt(body.amountMinor)
      )
        throw new AppError(
          409,
          "DELIVERY_PAYMENT_INVALID",
          "Payment must match the current selected delivery quote",
        );
      await tx.delivery.update({
        where: { id: d.id },
        data: { paidMinor: quote.amountMinor, paymentRef: body.reference, status: "PAID" },
      });
      await deliveryEvent(tx, d.id, "PAID", "admin", `${d.id}:paid`, req.auth!.sub);
      await audit(
        req,
        {
          action: "delivery.payment.confirmed",
          entityType: "delivery",
          entityId: d.id,
          after: { amountMinor: body.amountMinor, reference: body.reference },
        },
        tx,
      );
    });
    await queueBooking(order.id).catch(() => {});
    res.json({ confirmed: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/reconcile",
  requirePermission("orders.manage"),
  async (req, res) => {
    const order = await orderAccess(req);
    const d = order.delivery;
    if (!d) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
    if (!d.providerShipmentId)
      throw new AppError(
        409,
        "MANUAL_RECONCILIATION_REQUIRED",
        "Locate the shipment in Shipbubble and link it; do not repeat an uncertain booking",
      );
    await prisma.delivery.update({ where: { id: d.id }, data: { nextSyncAt: new Date() } });
    res.status(202).json({ queued: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/link",
  requirePermission("orders.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const order = await orderAccess(req);
    const d = order.delivery;
    const { providerShipmentId, reason } = z
      .object({
        providerShipmentId: z.string().min(3).max(160),
        reason: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    if (!d || d.providerShipmentId || d.status !== "BOOKING_UNCERTAIN")
      throw new AppError(409, "DELIVERY_NOT_LINKABLE", "Only uncertain bookings can be linked");
    const tracked = await shippingProvider.track(providerShipmentId);
    const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const pickup = contactSchema.parse(d.pickup);
    const destination = contactSchema.parse(d.destination);
    if (
      !tracked.pickupAddress ||
      !tracked.destinationAddress ||
      !normalize(tracked.pickupAddress).includes(normalize(pickup.address)) ||
      !normalize(tracked.destinationAddress).includes(normalize(destination.address)) ||
      tracked.shippingMinor !== d.shippingMinor ||
      tracked.courier !== d.courier
    )
      throw new AppError(
        409,
        "SHIPMENT_MISMATCH",
        "Provider shipment addresses, courier, and delivery charge must match this order",
      );
    await prisma.$transaction(async (tx) => {
      const result = await tx.delivery.updateMany({
        where: { id: d.id, status: "BOOKING_UNCERTAIN", providerShipmentId: null },
        data: {
          providerShipmentId: tracked.id,
          status: "BOOKED",
          trackingUrl: tracked.trackingUrl,
          courier: tracked.courier,
          failureCode: null,
        },
      });
      if (!result.count) throw new AppError(409, "STALE_RECORD", "Delivery changed");
      await deliveryEvent(tx, d.id, "BOOKED", "admin", `${d.id}:linked`, req.auth!.sub);
      await audit(
        req,
        {
          action: "delivery.linked",
          entityType: "delivery",
          entityId: d.id,
          after: { providerShipmentId, reason },
        },
        tx,
      );
    });
    res.json({ linked: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/cancel",
  requirePermission("orders.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const order = await orderAccess(req);
    const reason = z.string().trim().min(10).max(500).parse(req.body.reason);
    const d = order.delivery;
    if (!d?.providerShipmentId || ["DELIVERED", "CANCELLED", "RETURNED"].includes(d.status))
      throw new AppError(409, "CANNOT_CANCEL", "This shipment cannot be cancelled");
    await prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id: d.id },
        data: { cancelRequestedAt: new Date(), nextSyncAt: new Date() },
      });
      await audit(
        req,
        {
          action: "delivery.cancel.requested",
          entityType: "delivery",
          entityId: d.id,
          after: { reason },
        },
        tx,
      );
    });
    res.status(202).json({
      requested: true,
      message: "Cancellation requested; no external refund has been issued.",
    });
  },
);
customerDeliveryRouter.post("/:id/delivery/confirm", async (req, res) => {
  const order = await orderAccess(req);
  if (order.buyerId !== req.auth!.sub || order.delivery?.status !== "DELIVERED")
    throw new AppError(409, "DELIVERY_NOT_READY", "Only the buyer can confirm a delivered order");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
    await unlockedCheckout(tx, order.id);
    const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id } });
    if (current.status !== "FUNDED" && current.status !== "DELIVERED")
      throw new AppError(409, "ORDER_NOT_FUNDED", "Order cannot be confirmed");
    await tx.tradeOrder.update({
      where: { id: order.id },
      data: { status: "DELIVERED", deliveryConfirmedAt: new Date() },
    });
    await audit(
      req,
      { action: "delivery.recipient.confirmed", entityType: "order", entityId: order.id },
      tx,
    );
  });
  res.json({ confirmed: true });
});
// Unauthenticated events never change delivery state: only accelerate an authenticated provider read.
deliveryWebhookRouter.post("/shipbubble", async (req, res) => {
  const body = z
    .object({ order_id: z.string().min(1).max(160) })
    .safeParse(req.body?.data ?? req.body);
  if (body.success)
    await prisma.delivery.updateMany({
      where: {
        providerShipmentId: body.data.order_id,
        nextSyncAt: { gt: new Date(Date.now() + 60000) },
      },
      data: { nextSyncAt: new Date(Date.now() + 60000) },
    });
  res.status(202).json({ accepted: true });
});

staffDeliveryRouter.post(
  "/:id/delivery/manual-dispatch",
  requirePermission("orders.manage"),
  async (req, res) => {
    const order = await orderAccess(req);
    const body = z
      .object({
        carrier: z.string().trim().min(2).max(120),
        trackingRef: z.string().trim().min(2).max(120),
        reason: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { delivery: true },
      });
      const d = current.delivery;
      if (current.status !== "FUNDED" || !d || d.status !== "MANUAL_REVIEW" || d.providerShipmentId)
        throw new AppError(
          409,
          "MANUAL_DISPATCH_NOT_READY",
          "Manual dispatch requires a funded order in manual review",
        );
      await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: body.carrier,
          trackingRef: body.trackingRef,
          evidence: body.reason,
        },
      });
      await tx.delivery.update({
        where: { id: d.id },
        data: { status: "MANUAL_ASSIGNED", courier: body.carrier },
      });
      await deliveryEvent(
        tx,
        d.id,
        "MANUAL_ASSIGNED",
        "admin",
        `${d.id}:manual-assigned`,
        req.auth!.sub,
      );
      await audit(
        req,
        { action: "delivery.manual.assigned", entityType: "delivery", entityId: d.id, after: body },
        tx,
      );
    });
    res.json({ assigned: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/manual-status",
  requirePermission("orders.manage"),
  async (req, res) => {
    const order = await orderAccess(req);
    const body = z
      .object({
        status: z.enum([
          "PICKED_UP",
          "IN_TRANSIT",
          "DELIVERED",
          "FAILED_ATTEMPT",
          "RETURNING",
          "RETURNED",
          "CANCELLED",
        ]),
        evidence: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { delivery: true, shipment: true },
      });
      const d = current.delivery;
      if (
        !d ||
        !current.shipment ||
        d.providerShipmentId ||
        !["FUNDED", "DELIVERED"].includes(current.status) ||
        ["MANUAL_REVIEW", "QUOTE_REQUIRED", "PAYMENT_PENDING"].includes(d.status) ||
        !canAdvanceDelivery(d.status, body.status)
      )
        throw new AppError(
          409,
          "INVALID_MANUAL_TRANSITION",
          "Manual shipment cannot move to this status",
        );
      if (body.status === "DELIVERED" && d.status !== "IN_TRANSIT")
        throw new AppError(
          409,
          "INVALID_MANUAL_TRANSITION",
          "Mark the shipment in transit before delivery",
        );
      await tx.delivery.update({ where: { id: d.id }, data: { status: body.status } });
      await tx.shipment.update({
        where: { orderId: order.id },
        data: { status: body.status, evidence: body.evidence },
      });
      await deliveryEvent(
        tx,
        d.id,
        body.status,
        "admin",
        `${d.id}:manual:${body.status}`,
        req.auth!.sub,
      );
      await audit(
        req,
        { action: "delivery.manual.status", entityType: "delivery", entityId: d.id, after: body },
        tx,
      );
    });
    res.json({ updated: true });
  },
);
