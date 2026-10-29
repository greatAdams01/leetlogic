import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  version: 0,
  listeners: new Set<(state: string) => void>(),
}));
vi.mock("./api", () => ({ api: h.api, sessionVersion: () => h.version }));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_: string, listener: (state: string) => void) => {
      h.listeners.add(listener);
      return { remove: () => h.listeners.delete(listener) };
    },
  },
}));
import { useConnectedDevices } from "./connected-devices";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let result: ReturnType<typeof useConnectedDevices>;
let tree: ReactTestRenderer;
function Probe({ id = "farmer" }: { id?: string }) {
  result = useConnectedDevices(id);
  return null;
}
const item = {
  id: "real-session",
  current: true,
  deviceName: "Farmer Android",
  platform: "android",
  createdAt: "2026-10-29",
  lastUsedAt: "2026-10-29",
};
beforeEach(() => {
  vi.resetAllMocks();
  h.version = 0;
  h.listeners.clear();
  h.api.mockResolvedValue({ items: [item] });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.useRealTimers();
});
async function mount() {
  await act(async () => {
    tree = create(<Probe />);
  });
}
it("shows only server-returned devices and reloads when returning to foreground", async () => {
  await mount();
  expect(result.data?.items).toEqual([item]);
  h.api.mockResolvedValue({ items: [] });
  await act(async () => {
    h.listeners.forEach((listener) => listener("active"));
  });
  expect(result.data?.items).toEqual([]);
});
it("clears stale rows on failure rather than showing sample data or a zero count", async () => {
  await mount();
  h.api.mockRejectedValue(new Error("Offline"));
  await act(async () => result.reload());
  expect(result.data).toBeNull();
  expect(result.error).not.toBe("");
  expect(result.loading).toBe(false);
});
it("does not fabricate devices for an invalid server response", async () => {
  h.api.mockResolvedValue({});
  await mount();
  expect(result.data).toBeNull();
  expect(result.error).not.toBe("");
});
it("ignores a response belonging to the previous account", async () => {
  let resolve!: (value: object) => void;
  h.api.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount();
  h.version++;
  h.api.mockResolvedValue({ items: [] });
  await act(async () => tree.update(<Probe id="other-farmer" />));
  await act(async () => resolve({ items: [item] }));
  expect(result.data?.items).toEqual([]);
});
it("refreshes the list while the screen is open", async () => {
  vi.useFakeTimers();
  await mount();
  h.api.mockResolvedValue({ items: [] });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(result.data?.items).toEqual([]);
});
