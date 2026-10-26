import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ store: new Map<string, string>(), signed: false, generation: 0 }));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert() {} },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => h.store.get(k) || null,
    setItem: async (k: string, v: string) => {
      h.store.set(k, v);
    },
  },
}));
vi.mock("../components/feedback", () => ({ Feedback: () => null }));
vi.mock("../localization", () => ({ LocaleProvider: ({ children }: any) => children }));
vi.mock("./farmer-security", () => ({ readSecurity: async () => null }));
vi.mock("./api", () => ({
  api: async (path: string) => (path === "/auth/logout" ? new Promise(() => {}) : { messages: {} }),
  hydrateSession: async () => false,
  clearSession: async () => {
    h.signed = false;
    h.generation++;
  },
  authHeaders: () => (h.signed ? { Authorization: "Bearer account" } : {}),
  sessionVersion: () => h.generation,
}));
import { AppProvider, useApp } from "../state";
let current: ReturnType<typeof useApp>;
let tree: ReactTestRenderer;
function Probe() {
  current = useApp();
  return null;
}
afterEach(async () => {
  await act(async () => tree?.unmount());
  h.store.clear();
});
it("logs out immediately to the app start and never carries seller intent to another account", async () => {
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  await act(async () => {
    await current.selectRole("SELLER");
  });
  expect(current.route.name).toBe("phone");
  expect(current.role).toBe("SELLER");
  await act(async () => {
    await current.signOut();
  });
  expect(current.route.name).toBe("language");
  expect(current.role).toBe("BUYER");
  expect(current.user).toBeNull();
  await act(async () => {
    await current.finishSignIn({ id: "different", farmerProfile: null } as any);
  });
  expect(current.route.name).toBe("role");
  expect(h.store.get("account-role:different")).toBeUndefined();
});
it("lets buyers browse without a phone code or farmer security", async () => {
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  await act(async () => {
    await current.selectRole("BUYER");
  });
  expect(current.route.name).toBe("home");
  expect(current.user).toBeNull();
  expect(current.security).toBeNull();
});
