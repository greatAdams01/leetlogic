import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { getConfig } from "./config.js";
const config = getConfig();
const server = createApp().listen(config.PORT, () => logger.info({ port: config.PORT }, "Leetlogic API started"));
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => server.close(() => process.exit(0)));

