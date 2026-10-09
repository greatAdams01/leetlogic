import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = resolve(appDirectory, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Local pnpm dependencies live above this app's nested Git repository.
    // A standalone Netlify checkout resolves everything inside the app instead.
    root: existsSync(join(workspaceDirectory, "pnpm-workspace.yaml"))
      ? workspaceDirectory
      : appDirectory,
  },
};

export default nextConfig;
