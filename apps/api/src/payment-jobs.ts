import { sendPaidOrderNotifications } from "./services/order-notifications.js";
import { startPaymentWorker } from "./services/payment-worker.js";
import { prisma } from "@leetlogic/database";
import { redis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
const stop = startPaymentWorker();
let notifying = false;
const notifications = setInterval(async () => {
  if (notifying) return;
  notifying = true;
  try {
    await sendPaidOrderNotifications();
  } catch (error) {
    logger.error({ error }, "Paid-order notification worker failed");
  } finally {
    notifying = false;
  }
}, 15000);
const keepAlive = setInterval(() => {}, 60000);
logger.info("Payment worker started");
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    stop();
    clearInterval(notifications);
    clearInterval(keepAlive);
    await prisma.$disconnect();
    await redis().quit();
    process.exit(0);
  });
