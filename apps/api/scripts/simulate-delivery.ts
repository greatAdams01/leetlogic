import { prisma } from "@leetlogic/database";
import { z } from "zod";
import { getConfig } from "../src/config.js";
import { Shipbubble } from "../src/providers/shipping/shipbubble.js";
import { applyTracking } from "../src/services/delivery.js";
import { completeParcelPlan } from "../src/services/delivery-policy.js";
import { trackSplitDelivery } from "../src/services/split-delivery.js";

try {
  const config = getConfig();
  if (config.SHIPBUBBLE_MODE !== "test" || !config.SHIPBUBBLE_TEST_KEY_CONFIRMED)
    throw new Error("Confirmed Shipbubble test mode is required.");
  const orderId = z.string().uuid().parse(process.argv[2]);
  const status = z.enum(["picked_up", "in_transit", "completed"]).parse(process.argv[3]);
  const order = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId }, include: { delivery: { include: { parcels: true } } } });
  const delivery = order.delivery;
  if (order.status !== "FUNDED" || order.financialHold || order.deliveryConfirmedAt || !delivery?.providerShipmentId || delivery.cancelRequestedAt)
    throw new Error("Simulation requires an open funded courier order without a hold, receipt or cancellation.");
  if (delivery.parcels.length && !completeParcelPlan(delivery)) throw new Error("The parcel plan is incomplete.");
  const provider = new Shipbubble();
  const ids = delivery.parcels.length ? delivery.parcels.map(p => p.providerShipmentId!) : [delivery.providerShipmentId];
  if (ids.some(id => id.startsWith("split:"))) throw new Error("Actual courier shipment IDs are required.");
  for (const id of ids) await provider.simulateWebhook(id, status);
  // A successful simulator response proves webhook dispatch, not courier completion.
  const tracked = delivery.providerShipmentId.startsWith("split:")
    ? await trackSplitDelivery(provider, delivery.id)
    : await provider.track(delivery.providerShipmentId);
  await applyTracking(delivery.id, tracked);
  console.log(JSON.stringify({ orderId, requestedStatus: status, verifiedProviderStatus: tracked.status, message: "Only authenticated tracking was applied. Buyer inspection and receipt confirmation are still required." }));
} catch (error) {
  const failure = error as { code?: string; name?: string };
  console.error(JSON.stringify({ error: failure.code || failure.name || "SIMULATION_FAILED", message: "Simulation did not finish. Check test configuration, shipment eligibility and provider connectivity. No buyer receipt was recorded." }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
