import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = resolve(appDirectory, "../..");

// Next sets its own dev/build/start NODE_ENV before reading this config.
// Load shared server settings here without overriding that or deployment values.
const rootEnv = join(workspaceDirectory, ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Local pnpm dependencies live above this app's nested Git repository.
    // A standalone Netlify checkout resolves everything inside the app instead.
    root: existsSync(join(workspaceDirectory, "pnpm-workspace.yaml"))
      ? workspaceDirectory
      : appDirectory,
    // The shared NodeNext contract keeps a .js specifier for its emitted ESM.
    // Resolve its TypeScript source when imported directly into the web bundle.
    resolveAlias: {
      "./coordinates.js": "../../packages/contracts/src/coordinates.ts",
    },
  },
};

export default nextConfig;
