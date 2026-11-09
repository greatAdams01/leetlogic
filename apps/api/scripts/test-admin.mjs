import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const databaseRequire = createRequire(resolve("../../packages/database/package.json"));
const url = new URL(process.env.DATABASE_URL);
const redisUrl = new URL(process.env.REDIS_URL);
if (![url, redisUrl].every((target) => ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))
  throw new Error("Admin integration tests require local PostgreSQL and Redis.");
url.searchParams.set("schema", `leetlogic_admin_integration_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
redisUrl.pathname = "/15";
const env = {
  ...process.env,
  MEDIA_STORAGE: "local",
  REDIS_URL: redisUrl.toString(),
  DATABASE_URL: url.toString(),
  NODE_ENV: "test",
  PAYMENTS_ENABLED: "false",
  LOG_LEVEL: "fatal",
  PRIVATE_STORAGE_ROOT: process.env.PRIVATE_STORAGE_ROOT || ".private-objects/admin-tests",
  ADMIN_INTEGRATION: "1",
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
  [require.resolve("vitest/vitest.mjs"), "run", "src/routes/admin.integration.test.ts"],
  { env, stdio: "inherit" },
);
