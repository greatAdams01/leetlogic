import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const databaseRequire = createRequire(resolve("../../packages/database/package.json"));
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("schema", "leetlogic_admin_integration");
const redisUrl = new URL(process.env.REDIS_URL);
redisUrl.pathname = "/15";
const env = {
  ...process.env,
  MEDIA_STORAGE: "local",
  REDIS_URL: redisUrl.toString(),
  DATABASE_URL: url.toString(),
  NODE_ENV: "test",
  PAYMENTS_ENABLED: "false",
  LOG_LEVEL: "fatal",
  PRIVATE_STORAGE_ROOT: "/tmp/leetlogic-admin-docs-tests",
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
