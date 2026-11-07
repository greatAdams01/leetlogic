import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

const appDirectory = new URL("../", import.meta.url);

it.each(["coordinates", "delivery-visibility"])(
  "resolves the shared %s contract's .js import to TypeScript",
  (name) => {
    const target = `../../packages/contracts/src/${name}.ts`;
    expect(nextConfig.turbopack?.resolveAlias?.[`./${name}.js`]).toBe(target);
    expect(existsSync(new URL(target, appDirectory))).toBe(true);
  },
);
