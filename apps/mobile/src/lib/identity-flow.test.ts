import { describe, expect, it, vi } from "vitest";
import { createIdentityFlow, type IdentityData } from "./identity-flow";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const data = (pending = false): IdentityData => ({
  available: true,
  consentVersion: "v1",
  passed: false,
  check: pending ? { status: "PENDING", mode: "sandbox" } : null,
});
const verified: IdentityData = {
  ...data(),
  passed: true,
  check: { status: "VERIFIED", mode: "sandbox" },
};
async function ready(pending = false) {
  const deps = {
    read: vi.fn().mockResolvedValue(data(pending)),
    reconcile: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue({
      url: "https://identity.dojah.io/?widget_id=test",
      check: data(true).check,
    }),
    open: vi.fn().mockResolvedValue(undefined),
    onStatus: vi.fn(),
  };
  const flow = createIdentityFlow(deps);
  flow.activate();
  await flow.load();
  deps.reconcile.mockClear();
  return { deps, flow };
}
describe("Dojah action and app-return coordination", () => {
  it("checking results never launches Dojah and deduplicates rapid taps", async () => {
    const { deps, flow } = await ready(true);
    const response = deferred<void>();
    deps.reconcile.mockReturnValue(response.promise);
    const checking = flow.check();
    void flow.check();
    void flow.launch(true);
    expect(flow.getSnapshot().operation).toBe("checking");
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
    expect(deps.start).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
    response.resolve();
    await checking;
    expect(flow.getSnapshot().operation).toBe("idle");
  });
  it("rechecks an existing reviewed result without reopening the browser or creating a session", async () => {
    const { deps, flow } = await ready(true);
    deps.read.mockResolvedValueOnce({
      ...data(true),
      check: { status: "REVIEW", mode: "sandbox" },
    });
    await flow.load();
    deps.reconcile.mockClear();
    deps.read.mockResolvedValueOnce(verified);
    await flow.check();
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
    expect(flow.getSnapshot().data?.passed).toBe(true);
    expect(deps.start).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
  });
  it("restores a successful previous attempt on entry without starting another verification", async () => {
    const { deps, flow } = await ready();
    deps.read
      .mockResolvedValueOnce({
        ...data(),
        check: { status: "FAILED", mode: "sandbox" },
      })
      .mockResolvedValueOnce(verified);
    await flow.load();
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
    expect(flow.getSnapshot().data?.passed).toBe(true);
    expect(deps.onStatus).toHaveBeenLastCalledWith(true);
    expect(deps.start).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
  });
  it("checks existing attempts before a retry and stops when an earlier one passed", async () => {
    const { deps, flow } = await ready(true);
    deps.read.mockResolvedValueOnce(verified);
    await flow.launch(true);
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
    expect(flow.getSnapshot().data?.passed).toBe(true);
    expect(deps.start).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
  });
  it("preserves previous attempts and does not start another check when recovery is unavailable", async () => {
    const { deps, flow } = await ready(true);
    const error = new Error("Provider unavailable");
    deps.reconcile.mockRejectedValueOnce(error);
    await flow.launch(true);
    expect(flow.getSnapshot().error).toBe(error);
    expect(flow.getSnapshot().data?.check?.status).toBe("PENDING");
    expect(deps.start).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
  });
  it("launching is consented, runs once, and does not immediately check on browser open", async () => {
    const { deps, flow } = await ready();
    await flow.launch(false);
    expect(deps.start).not.toHaveBeenCalled();
    const opened = deferred<void>();
    deps.open.mockReturnValue(opened.promise);
    const launching = flow.launch(true);
    void flow.launch(true);
    void flow.check();
    await vi.waitFor(() => expect(deps.open).toHaveBeenCalledTimes(1));
    expect(flow.getSnapshot().operation).toBe("launching");
    expect(deps.start).toHaveBeenCalledTimes(1);
    opened.resolve();
    await launching;
    expect(flow.getSnapshot().operation).toBe("idle");
    expect(deps.reconcile).not.toHaveBeenCalled();
  });
  it("coalesces automatic return checking with a manual check", async () => {
    const { deps, flow } = await ready(true);
    const response = deferred<void>();
    deps.reconcile.mockReturnValue(response.promise);
    flow.returned();
    void flow.check();
    flow.returned();
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
    response.resolve();
    await vi.waitFor(() => expect(flow.getSnapshot().operation).toBe("idle"));
    expect(deps.start).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
  });
  it("queues a single fast foreground return until browser launch finishes", async () => {
    const { deps, flow } = await ready();
    const opened = deferred<void>();
    deps.open.mockReturnValue(opened.promise);
    const launching = flow.launch(true);
    await vi.waitFor(() => expect(deps.open).toHaveBeenCalledTimes(1));
    flow.returned();
    flow.returned();
    expect(deps.reconcile).not.toHaveBeenCalled();
    opened.resolve();
    await launching;
    await vi.waitFor(() => expect(flow.getSnapshot().operation).toBe("idle"));
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
    expect(deps.start).toHaveBeenCalledTimes(1);
  });
  it("keeps polling silent and ignores a stale pending response after a successful explicit check", async () => {
    const { deps, flow } = await ready(true);
    const stale = deferred<IdentityData>();
    deps.read.mockReturnValueOnce(stale.promise);
    const poll = flow.poll();
    expect(flow.getSnapshot().operation).toBe("idle");
    deps.read.mockResolvedValueOnce(verified);
    await flow.check();
    stale.resolve(data(true));
    await poll;
    expect(flow.getSnapshot().data?.passed).toBe(true);
    expect(flow.getSnapshot().error).toBeNull();
    expect(deps.start).not.toHaveBeenCalled();
  });
  it("continues polling after a foreground action supersedes a background read", async () => {
    const { deps, flow } = await ready(true);
    const stale = deferred<IdentityData>();
    deps.read.mockReturnValueOnce(stale.promise);
    const poll = flow.poll();
    await flow.check();
    stale.resolve(data(true));
    await poll;
    const count = deps.read.mock.calls.length;
    await flow.poll();
    expect(deps.read).toHaveBeenCalledTimes(count + 1);
  });
  it("shows a check failure without changing the session or losing the error to polling", async () => {
    const { deps, flow } = await ready(true);
    const error = new Error("provider unavailable");
    deps.reconcile.mockRejectedValueOnce(error);
    await flow.check();
    await flow.poll();
    expect(flow.getSnapshot().operation).toBe("idle");
    expect(flow.getSnapshot().error).toBe(error);
    expect(deps.start).not.toHaveBeenCalled();
    await flow.check();
    expect(flow.getSnapshot().error).toBeNull();
  });
  it("never applies old results or opens a browser after unmount, and can reactivate safely", async () => {
    const { deps, flow } = await ready();
    const start = deferred<{ url: string; check: IdentityData["check"] }>();
    deps.start.mockReturnValue(start.promise);
    const launching = flow.launch(true);
    flow.dispose();
    start.resolve({ url: "https://identity.dojah.io/", check: data(true).check });
    await launching;
    expect(deps.open).not.toHaveBeenCalled();
    flow.activate();
    await flow.load();
    expect(flow.getSnapshot().operation).toBe("idle");
  });
  it("blocks new launches after verification and rejects non-Dojah browser targets", async () => {
    const { deps, flow } = await ready();
    deps.start.mockResolvedValueOnce({
      url: "https://untrusted.example/",
      check: data(true).check,
    });
    await flow.launch(true);
    expect(deps.open).not.toHaveBeenCalled();
    expect(flow.getSnapshot().error).toBeInstanceOf(Error);
    deps.read.mockResolvedValueOnce(verified);
    await flow.load();
    deps.start.mockClear();
    await flow.launch(true);
    expect(deps.start).not.toHaveBeenCalled();
  });
});
