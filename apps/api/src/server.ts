import { startPaymentWorker } from "./services/payment-worker.js";
import { startDeliveryWorker } from "./services/delivery.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { getConfig } from "./config.js";
const config = getConfig();
const server = createApp().listen(config.PORT, () =>
  logger.info({ port: config.PORT }, "Leetlogic API started"),
);
const stopWorker = startDeliveryWorker();
const stopPayments = config.NODE_ENV === "production" ? () => {} : startPaymentWorker();
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    stopWorker();
    stopPayments();
    server.close(() => process.exit(0));
  });
