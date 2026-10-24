import { afterEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("__DEV__", true));
const storage = vi.hoisted(() => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => storage);
vi.mock("expo-crypto", () => ({ randomUUID: () => "test-device" }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { hostUri: "localhost:8082" } } }));
import { api, authHeaders, clearSession, saveSession, sessionVersion } from "./api";
afterEach(() => vi.unstubAllGlobals());
describe("account refresh session identity", () => {
  it("keeps the same identity while refreshing expired access tokens", async () => {
    await saveSession({ accessToken: "expired", refreshToken: "old-refresh" });
    const version = sessionVersion();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: { code: "SESSION_EXPIRED" } }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: "renewed", refreshToken: "new-refresh" }))
      .mockResolvedValueOnce(Response.json({ user: { id: "farmer" } }));
    vi.stubGlobal("fetch", fetcher);
    expect(await api("/me")).toEqual({ user: { id: "farmer" } });
    expect(authHeaders().Authorization).toBe("Bearer renewed");
    expect(sessionVersion()).toBe(version);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("invalidates prior account reads after sign out or a new login", async () => {
    await saveSession({ accessToken: "user-a", refreshToken: "refresh-a" });
    const oldVersion = sessionVersion();
    await clearSession();
    expect(sessionVersion()).not.toBe(oldVersion);
    expect(authHeaders().Authorization).toBeUndefined();
    await saveSession({ accessToken: "user-b", refreshToken: "refresh-b" });
    expect(sessionVersion()).not.toBe(oldVersion);
    expect(authHeaders().Authorization).toBe("Bearer user-b");
  });
});
