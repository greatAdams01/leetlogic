import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert() {} },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock("../components/feedback", () => ({ Feedback: () => null }));
vi.mock("../localization", () => ({ LocaleProvider: ({ children }: any) => children }));
vi.mock("./farmer-security", () => ({ readSecurity: async () => null }));
vi.mock("./api", () => ({
  api: h.api,
  hydrateSession: async () => false,
  authHeaders: () => ({}),
  sessionVersion: () => 0,
}));
import { AppProvider, useResource } from "../state";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it("does not replace a newer area filter with an older response", async () => {
  let lagos!: (value: unknown) => void;
  h.api.mockImplementation((path: string) =>
    path.includes("Lagos")
      ? new Promise((resolve) => {
          lagos = resolve;
        })
      : Promise.resolve(path.includes("Abia") ? { items: ["Abia farm"] } : { messages: {} }),
  );
  let result: ReturnType<typeof useResource>;
  function Probe({ path }: { path: string }) {
    result = useResource(path);
    return null;
  }
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(
        <AppProvider>
          <Probe path="/marketplace/listings?state=Lagos" />
        </AppProvider>,
      );
    });
    await act(async () =>
      tree.update(
        <AppProvider>
          <Probe path="/marketplace/listings?state=Abia" />
        </AppProvider>,
      ),
    );
    expect(result!.data).toEqual({ items: ["Abia farm"] });
    await act(async () => lagos({ items: ["Lagos farm"] }));
    expect(result!.data).toEqual({ items: ["Abia farm"] });
    expect(result!.loading).toBe(false);
  } finally {
    await act(async () => tree?.unmount());
  }
});
