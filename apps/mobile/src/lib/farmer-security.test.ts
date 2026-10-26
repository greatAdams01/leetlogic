import { beforeEach, describe, expect, it, vi } from "vitest";
const values = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => values.get(key) || null,
  setItemAsync: async (key: string, value: string) => {
    values.set(key, value);
  },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "salt",
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_: string, value: string) => `hashed-${value}`,
}));
import { createSecurity, checkPin, readSecurity, enableBiometric } from "./farmer-security";
beforeEach(() => values.clear());
describe("farmer device security", () => {
  it("keeps each account's PIN and biometric preference separate", async () => {
    await createSecurity("farmer-a", "1234");
    await enableBiometric("farmer-a", true);
    expect(await readSecurity("buyer-b")).toBeNull();
    await createSecurity("farmer-b", "5678");
    await expect(checkPin("farmer-b", "1234")).rejects.toThrow("incorrect");
    await expect(checkPin("farmer-a", "1234")).resolves.toBeUndefined();
    expect((await readSecurity("farmer-b"))?.biometric).toBe(false);
  });
  it("persists a cooldown after five wrong PINs", async () => {
    await createSecurity("a", "1234");
    for (let i = 0; i < 5; i++) await expect(checkPin("a", "9999")).rejects.toThrow();
    await expect(checkPin("a", "1234")).rejects.toThrow("Too many attempts");
  });
  it("rejects invalid PINs and resets device options on authenticated recovery", async () => {
    await expect(createSecurity("a", "12")).rejects.toThrow();
    await createSecurity("a", "1234");
    await enableBiometric("a", true);
    await createSecurity("a", "5678");
    await expect(checkPin("a", "1234")).rejects.toThrow();
    await expect(checkPin("a", "5678")).resolves.toBeUndefined();
    expect((await readSecurity("a"))?.biometric).toBe(false);
  });
});
