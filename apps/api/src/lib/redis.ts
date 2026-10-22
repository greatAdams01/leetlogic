import { Redis } from "ioredis";
import { getConfig } from "../config.js";
import { logger } from "./logger.js";
let client: Redis | undefined;
export function redis(): Redis {
  if (!client) {
    client = new Redis(getConfig().REDIS_URL, { maxRetriesPerRequest: 2 });
    let unavailable = false;
    // Report transitions rather than printing an unhandled error on every reconnect.
    client.on("error", () => {
      if (!unavailable)
        logger.error(
          { service: "redis" },
          "Redis connection unavailable; check Docker and REDIS_URL",
        );
      unavailable = true;
    });
    client.on("ready", () => {
      if (unavailable) logger.info({ service: "redis" }, "Redis connection restored");
      unavailable = false;
    });
  }
  return client;
}
