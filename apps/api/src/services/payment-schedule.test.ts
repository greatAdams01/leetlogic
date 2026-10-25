import { afterEach, describe, expect, it, vi } from "vitest";
import { startPaymentSchedule } from "./payment-schedule.js";
import { balanceOf } from "./payment-worker.js";

afterEach(() => vi.useRealTimers());

describe("payment worker scheduling", () => {
  it("backs off failed balance checks while continuing payment jobs", async () => {
    vi.useFakeTimers();
    const jobs = vi.fn().mockResolvedValue(undefined);
    const reconcile = vi.fn().mockRejectedValue(new Error("unavailable"));
    const report = vi.fn();
    const stop = startPaymentSchedule({ enabled: () => true, jobs, reconcile, report });
    await vi.advanceTimersByTimeAsync(15000);
    expect(report).toHaveBeenCalledWith(expect.any(Error), "balances", 300);
    await vi.advanceTimersByTimeAsync(285000);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveBeenCalledTimes(20);
    await vi.advanceTimersByTimeAsync(15000);
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith(expect.any(Error), "balances", 600);
    reconcile.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(600000);
    expect(reconcile).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(3600000);
    expect(reconcile).toHaveBeenCalledTimes(3);
    stop();
  });

  it("does not overlap runs, runs while disabled, or continue after stopping", async () => {
    vi.useFakeTimers();
    let enabled = false;
    let finish!: () => void;
    const jobs = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const stop = startPaymentSchedule({ enabled: () => enabled, jobs, reconcile, report: vi.fn() });
    await vi.advanceTimersByTimeAsync(15000);
    expect(jobs).not.toHaveBeenCalled();
    enabled = true;
    await vi.advanceTimersByTimeAsync(60000);
    expect(jobs).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(jobs).toHaveBeenCalledTimes(1);
  });

  it("backs off failed job scans independently of balance checks", async () => {
    vi.useFakeTimers();
    const jobs = vi.fn().mockRejectedValue(new Error("database"));
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const report = vi.fn();
    const stop = startPaymentSchedule({ enabled: () => true, jobs, reconcile, report });
    await vi.advanceTimersByTimeAsync(300000);
    expect(jobs).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.any(Error), "jobs", 300);
    stop();
  });
});

describe("NGN balance validation", () => {
  it("never treats USD-only or malformed balances as available NGN funds", () => {
    expect(() => balanceOf({ balances: [{ currency: "USD", available_balance: "100" }] })).toThrow(
      expect.objectContaining({
        diagnostics: expect.objectContaining({ reason: "NGN_BALANCE_MISSING" }),
      }),
    );
    expect(() => balanceOf({ balances: [{ currency: "NGN", available_balance: 100 }] })).toThrow();
    expect(balanceOf({ balances: [{ currency: "NGN", available_balance: "0.00" }] })).toBe(0n);
    expect(balanceOf({ balances: [{ currency: "NGN", available_balance: "123.45" }] })).toBe(
      12345n,
    );
  });
});
