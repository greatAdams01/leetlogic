import { prisma, Prisma } from "@leetlogic/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../lib/logger.js";
import { shippingProvider } from "./delivery.js";
import * as fulfillment from "./fulfillment-deadline.js";
import * as payments from "./payments.js";
import { startRecoveryWorker } from "./recovery-worker.js";

let stopWorker: (() => void) | undefined;
const schemaError = () =>
  new Prisma.PrismaClientKnownRequestError("private SQL password=secret", {
    code: "P2022",
    clientVersion: "test",
    meta: {
      modelName: "TradeOrder",
      column: "delivery_events.details",
      query: "private query values",
    },
  });

beforeEach(() => {
  vi.useFakeTimers();
  const heartbeat = {
    id: "payment:sandbox",
    checkedAt: new Date(),
    walletMinor: 1000n,
    walletCheckedAt: new Date(),
    walletError: null,
  };
  vi.spyOn(fulfillment, "financeEnabled").mockReturnValue(true);
  vi.spyOn(payments, "mode").mockReturnValue("sandbox");
  vi.spyOn(prisma.financeHeartbeat, "upsert").mockResolvedValue(heartbeat);
  vi.spyOn(prisma.financeHeartbeat, "findUnique").mockResolvedValue(heartbeat);
  vi.spyOn(prisma.paymentAttempt, "findMany").mockResolvedValue([]);
  vi.spyOn(prisma, "$queryRaw").mockResolvedValue([]);
  vi.spyOn(prisma.paymentRecovery, "findMany").mockResolvedValue([]);
  vi.spyOn(prisma.fulfillmentDeadline, "findMany").mockResolvedValue([]);
  vi.spyOn(shippingProvider, "wallet").mockResolvedValue(1000n);
  vi.spyOn(logger, "error").mockImplementation(() => {});
});

afterEach(() => {
  stopWorker?.();
  stopWorker = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function runWorker() {
  stopWorker = startRecoveryWorker();
  await vi.advanceTimersByTimeAsync(0);
}

describe("recovery worker diagnostics and retries", () => {
  it("reports a missing delivery column with safe migration diagnostics", async () => {
    vi.mocked(prisma.fulfillmentDeadline.findMany).mockRejectedValue(schemaError());
    await runWorker();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "RECOVERY_WORKER_FAILED",
        err: expect.objectContaining({
          type: "PrismaClientKnownRequestError",
          code: "DATABASE_SCHEMA_MISMATCH",
          database: {
            prismaCode: "P2022",
            model: "TradeOrder",
            column: "delivery_events.details",
          },
          hint: expect.stringContaining("prisma migrate deploy"),
        }),
      }),
      "Recovery worker requires attention",
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(
      /private SQL|password=secret|private query values/,
    );
  });

  it("distinguishes database downtime from missing migrations", async () => {
    vi.mocked(prisma.financeHeartbeat.upsert).mockRejectedValue(
      new Prisma.PrismaClientInitializationError(
        "postgresql://private-user:private-password@host/database",
        "test",
        "P1001",
      ),
    );
    await runWorker();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          code: "DATABASE_UNAVAILABLE",
          hint: expect.stringContaining("DATABASE_URL"),
        }),
      }),
      "Recovery worker requires attention",
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(
      /postgresql:\/\/|private-user|private-password/,
    );
  });

  it("does not log malformed database metadata or raw query messages", async () => {
    vi.mocked(prisma.fulfillmentDeadline.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("private SQL", {
        code: "P2022",
        clientVersion: "test",
        meta: {
          modelName: { secret: "private-model" },
          column: "delivery_events.details\npassword=secret",
          table: "postgresql://private-host",
        },
      }),
    );
    await runWorker();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ database: { prismaCode: "P2022" } }),
      }),
      "Recovery worker requires attention",
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(
      /private SQL|private-model|password=secret|private-host/,
    );
  });

  it("keeps unexpected errors actionable without exposing their messages", async () => {
    vi.mocked(prisma.financeHeartbeat.findUnique).mockRejectedValue(
      new TypeError("private provider payload"),
    );
    await runWorker();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          type: "TypeError",
          code: "RECOVERY_WORKER_FAILED",
          message: "Recovery background processing failed.",
        }),
      }),
      "Recovery worker requires attention",
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      "private provider payload",
    );
  });

  it("retries after the schema is repaired and stops cleanly", async () => {
    vi.mocked(prisma.fulfillmentDeadline.findMany).mockRejectedValueOnce(schemaError());
    await runWorker();
    expect(logger.error).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15000);
    expect(prisma.fulfillmentDeadline.findMany).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
    stopWorker?.();
    await vi.advanceTimersByTimeAsync(30000);
    expect(prisma.fulfillmentDeadline.findMany).toHaveBeenCalledTimes(2);
  });

  it("never overlaps a scan that is waiting for the database", async () => {
    let finish!: () => void;
    vi.mocked(prisma.paymentAttempt.findMany).mockImplementationOnce(
      () =>
        new Promise<never[]>((resolve) => {
          finish = () => resolve([]);
        }) as Prisma.PrismaPromise<never[]>,
    );
    await runWorker();
    await vi.advanceTimersByTimeAsync(45000);
    expect(prisma.financeHeartbeat.upsert).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(15000);
    expect(prisma.paymentAttempt.findMany).toHaveBeenCalledTimes(2);
  });

  it("does not scan while recovery is disabled", async () => {
    vi.mocked(fulfillment.financeEnabled).mockReturnValue(false);
    await runWorker();
    await vi.advanceTimersByTimeAsync(30000);
    expect(prisma.financeHeartbeat.upsert).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
