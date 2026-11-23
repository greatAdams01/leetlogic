import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock("./api", () => ({ api: h.api }));
vi.mock("../state", () => ({ useApp: () => ({ error: (e: Error) => e.message }) }));
import { notifyOrderChanges } from "./order-invalidation";
import { useOrderSearch } from "./use-order-search";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer, current: ReturnType<typeof useOrderSearch>;
function Probe() { current = useOrderSearch("buyer"); return null; }
beforeEach(() => { vi.useFakeTimers(); h.api.mockReset(); });
afterEach(async () => { await act(async () => tree?.unmount()); vi.useRealTimers(); });
it("combines debounced search and filters, and appends the server cursor page once", async () => {
  h.api.mockImplementation(async (path: string) => path.includes("cursor=") ? { items: [{ id: "b" }, { id: "a" }], nextCursor: null } : { items: [{ id: "a" }], nextCursor: "a" });
  await act(async () => { tree = create(<Probe />); });
  await act(async () => { current.setSearch("rice farmer"); current.setFilter("COMPLETED"); });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(h.api.mock.calls.at(-1)![0]).toContain("filter=COMPLETED&q=rice%20farmer");
  await act(async () => current.loadMore());
  expect(h.api.mock.calls.at(-1)![0]).toContain("&cursor=a");
  expect(current.data.items.map(i => i.id)).toEqual(["a", "b"]);
});
it("ignores a late response from a previous filter", async () => {
  let resolve!: (page: object) => void;
  h.api.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ items: [{ id: "new" }], nextCursor: null });
  await act(async () => { tree = create(<Probe />); });
  await act(async () => current.setFilter("CANCELLED"));
  await act(async () => resolve({ items: [{ id: "stale" }], nextCursor: "stale" }));
  expect(current.data.items.map(i => i.id)).toEqual(["new"]);
  expect(current.nextCursor).toBeNull();
});

it("refreshes admin changes through push and polling without blanking existing orders", async () => {
  h.api.mockResolvedValueOnce({ items: [{ id: "a", status: "FUNDED" }] });
  await act(async () => { tree = create(<Probe />); });
  let resolve!: (page: object) => void;
  h.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => notifyOrderChanges());
  expect(current.loading).toBe(false);
  expect(current.data.items[0]!.status).toBe("FUNDED");
  await act(async () => resolve({ items: [{ id: "a", status: "COMPLETED" }] }));
  expect(current.data.items[0]!.status).toBe("COMPLETED");
  h.api.mockResolvedValue({ items: [{ id: "a", status: "CANCELLED" }] });
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(current.data.items[0]!.status).toBe("CANCELLED");
});
