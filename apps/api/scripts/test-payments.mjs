import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url),
  databaseRequire = createRequire(resolve("../../packages/database/package.json"));
const url = new URL(process.env.DATABASE_URL);
const redis = new URL(process.env.REDIS_URL);
if (![url, redis].every((target) => ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))
  throw new Error("Payment integration tests require local PostgreSQL and Redis.");
// Retain prior runs for diagnostics without colliding with their provider IDs or worker queues.
url.searchParams.set("schema", `leetlogic_payments_integration_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
redis.pathname = "/13";
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  REDIS_URL: redis.toString(),
  NODE_ENV: "test",
  LOG_LEVEL: "fatal",
  MEDIA_STORAGE: "local",
  PRIVATE_STORAGE_ROOT: ".private-objects/payments-tests",
  OTP_PROVIDER: "console",
  NIPOST_ENABLED: "false",
  PAYMENTS_ENABLED: "false",
  PAYMENTS_INTEGRATION: "1",
};
execFileSync(
  process.execPath,
  [
    databaseRequire.resolve("prisma/build/index.js"),
    "migrate",
    "deploy",
    "--schema",
    "../../packages/database/prisma/schema.prisma",
  ],
  { env, stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [require.resolve("vitest/vitest.mjs"), "run", "src/routes/payments.integration.test.ts"],
  { env, stdio: "inherit" },
);
