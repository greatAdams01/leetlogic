import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const { resolver } = createRequire(import.meta.url)("../../metro.config.cjs");
const workspace = fileURLToPath(new URL("../../../../", import.meta.url));
const originModulePath = resolve(workspace, "packages/contracts/src/addresses.ts");

describe("shared contract Metro resolution", () => {
  it.each(["ios", "android"])("delegates NodeNext source imports for %s", (platform) => {
    const resolution = { type: "sourceFile", filePath: resolve(workspace, "packages/contracts/src/coordinates.ts") };
    const context = { originModulePath, resolveRequest: vi.fn(() => resolution) };
    expect(resolver.resolveRequest(context, "./coordinates.js", platform)).toBe(resolution);
    expect(context.resolveRequest).toHaveBeenCalledExactlyOnceWith(context, "./coordinates", platform);
  });

  it.each([
    "packages/contracts/dist/addresses.js",
    "packages/contracts/src-other/addresses.ts",
    "apps/mobile/src/lib/locations.ts",
    "node_modules/react-native/index.js",
  ])("leaves imports outside contract source unchanged: %s", (origin) => {
    const context = { originModulePath: resolve(workspace, origin), resolveRequest: vi.fn() };
    resolver.resolveRequest(context, "./coordinates.js", "ios");
    expect(context.resolveRequest).toHaveBeenCalledExactlyOnceWith(context, "./coordinates.js", "ios");
  });

  it.each(["zod", "./coordinates", "./coordinates.ts", "./data.json"])("preserves other specifiers: %s", (moduleName) => {
    const context = { originModulePath, resolveRequest: vi.fn() };
    resolver.resolveRequest(context, moduleName, "android");
    expect(context.resolveRequest).toHaveBeenCalledExactlyOnceWith(context, moduleName, "android");
  });
});
