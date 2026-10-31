import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

const require = createRequire(import.meta.url);
const databaseRequire = createRequire(resolve("../../packages/database/package.json"));
const url = new URL(process.env.DATABASE_URL);
const redisUrl = new URL(process.env.REDIS_URL);
if (![url, redisUrl].every((target) => ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))
  throw new Error("Authentication integration tests require local PostgreSQL and Redis.");
url.searchParams.set("schema", `leetlogic_auth_integration_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
redisUrl.pathname = "/12";
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  REDIS_URL: redisUrl.toString(),
  NODE_ENV: "test",
  OTP_PROVIDER: "console",
  PAYMENTS_ENABLED: "false",
  DELIVERY_ENABLED: "false",
  MEDIA_STORAGE: "local",
  LOG_LEVEL: "fatal",
  PRIVATE_STORAGE_ROOT: ".private-objects/auth-tests",
  AUTH_INTEGRATION: "1",
};
execFileSync(process.execPath, [
  databaseRequire.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema",
  "../../packages/database/prisma/schema.prisma",
], { env, stdio: "inherit" });
execFileSync(process.execPath, [
  require.resolve("vitest/vitest.mjs"), "run", "--no-file-parallelism", "src/routes/auth.integration.test.ts",
], { env, stdio: "inherit" });
