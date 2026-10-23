import { startPaymentWorker } from "./services/payment-worker.js";
import { prisma } from "@leetlogic/database";
import { redis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
const stop = startPaymentWorker();
const keepAlive = setInterval(() => {}, 60000);
logger.info("Payment worker started");
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    stop();
    clearInterval(keepAlive);
    await prisma.$disconnect();
    await redis().quit();
    process.exit(0);
  });
