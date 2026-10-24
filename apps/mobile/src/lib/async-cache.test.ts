import { describe, expect, it, vi } from "vitest";
import { assetCache, singleFlight } from "./async-cache";

describe("shared mobile reads", () => {
  it("deduplicates concurrent account refreshes without caching stale approvals", async () => {
    const load = vi.fn().mockResolvedValue({ status: "PENDING" });
    const read = singleFlight(load);
    const first = read("session"),
      second = read("session");
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(load).toHaveBeenCalledTimes(1);
    load.mockResolvedValue({ status: "APPROVED" });
    expect(await read("session")).toEqual({ status: "APPROVED" });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("separates sessions and permits retry after a failed refresh", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("ok");
    const read = singleFlight(load);
    await expect(read("old-session")).rejects.toThrow("offline");
    expect(await read("old-session")).toBe("ok");
    expect(await read("new-session")).toBe("ok");
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("reads repeated immutable icons once, including concurrent Menu chevrons", async () => {
    const load = vi.fn().mockResolvedValue("<svg />");
    const cache = assetCache(load);
    await Promise.all(Array.from({ length: 6 }, () => cache.read("chevron")));
    expect(cache.peek("chevron")).toBe("<svg />");
    expect(await cache.read("chevron")).toBe("<svg />");
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("does not cache a failed asset read", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("missing")).mockResolvedValue("<svg />");
    const cache = assetCache(load);
    await expect(cache.read("chevron")).rejects.toThrow("missing");
    expect(await cache.read("chevron")).toBe("<svg />");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
