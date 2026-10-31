import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: [] as any[], book: vi.fn(), track: vi.fn(), cancel: vi.fn() }));
vi.mock("@leetlogic/database", () => {
  const client = {
    delivery: { update: vi.fn() },
    deliveryParcel: {
      upsert: async ({ create }: any) => {
        const row = h.rows.find((item) => item.parcelIndex === create.parcelIndex);
        if (!row)
          h.rows.push({
            ...create,
            id: String(create.parcelIndex),
            status: "PENDING",
            providerShipmentId: null,
            actualMinor: null,
          });
      },
      findMany: async () => h.rows.map((row) => ({ ...row })),
      updateMany: async ({ where, data }: any) => {
        const row = h.rows.find((item) =>
          Object.entries(where).every(([key, value]) => item[key] === value),
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      update: async ({ where, data }: any) =>
        Object.assign(
          h.rows.find((item) => item.id === where.id),
          data,
        ),
    },
  };
  return { prisma: { ...client, $transaction: async (callback: any) => callback(client) } };
});
import {
  bookSplitDelivery,
  aggregateParcelStatus,
  recordedSplitBooking,
  splitPlanMatches,
  trackSplitDelivery,
} from "./split-delivery.js";
import { splitParts } from "../providers/shipping/shipbubble.js";
const quote = {
  id: "quote",
  courier: "Courier",
  requestToken:
    "split:" +
    JSON.stringify(
      [0, 1].map((index) => ({
        requestToken: String(index),
        courierId: "courier",
        serviceCode: "pickup",
        amountMinor: "1000",
        walletMinor: "1000",
      })),
    ),
};
const recorded = () => splitParts(quote.requestToken)!.map((part, parcelIndex) => ({
  id: String(parcelIndex),
  deliveryId: "delivery",
  quoteId: quote.id,
  parcelIndex,
  ...part,
  amountMinor: BigInt(part.amountMinor),
  walletMinor: BigInt(part.walletMinor),
  actualMinor: 1000n,
  providerShipmentId: `SB-${parcelIndex}`,
  cancelAttemptedAt: null,
  status: "BOOKED",
}));
beforeEach(() => {
  h.rows = [];
  vi.resetAllMocks();
});
it("persists each confirmed parcel and never books it again", async () => {
  h.book.mockImplementation(async (part) => ({
    id: `SB-${part.parcelIndex}`,
    courier: "Courier",
    status: "pending",
    shippingMinor: 1000n,
  }));
  const result = await bookSplitDelivery({ book: h.book } as any, "delivery", quote);
  expect(result?.shippingMinor).toBe(2000n);
  expect(h.rows.every((row) => row.status === "BOOKED")).toBe(true);
  await bookSplitDelivery({ book: h.book } as any, "delivery", quote);
  expect(h.book).toHaveBeenCalledTimes(2);
});
it("retains a confirmed first parcel and refuses to replay an uncertain second booking", async () => {
  h.book
    .mockResolvedValueOnce({
      id: "SB-one",
      courier: "Courier",
      status: "pending",
      shippingMinor: 1000n,
    })
    .mockRejectedValueOnce(new Error("timeout"));
  await expect(bookSplitDelivery({ book: h.book } as any, "delivery", quote)).rejects.toThrow(
    "timeout",
  );
  expect(h.rows[0].providerShipmentId).toBe("SB-one");
  expect(h.rows[1].status).toBe("BOOKING_UNCERTAIN");
  await expect(bookSplitDelivery({ book: h.book } as any, "delivery", quote)).rejects.toThrow(
    "SPLIT_BOOKING_UNCERTAIN",
  );
  expect(h.book).toHaveBeenCalledTimes(2);
});
it("records an unexpected parcel courier for review without buying its label again", async () => {
  h.book.mockImplementation(async (part) => ({
    id: `SB-${part.parcelIndex}`,
    courier: part.parcelIndex === 0 ? "Courier" : "Unexpected courier",
    status: "pending",
    shippingMinor: 1000n,
  }));
  const provider = { book: h.book } as any;
  const result = await bookSplitDelivery(provider, "delivery", quote);
  expect(result).toMatchObject({ shippingMinor: 2000n, requiresReview: true });
  expect(h.rows[1]).toMatchObject({ providerShipmentId: "SB-1", status: "BOOKED", failureCode: "SHIPMENT_MISMATCH" });
  expect(await bookSplitDelivery(provider, "delivery", quote)).toMatchObject({ requiresReview: true });
  expect(h.book).toHaveBeenCalledTimes(2);
});
it("does not mark a whole order delivered until every parcel arrives", () => {
  expect(aggregateParcelStatus(["DELIVERED", "BOOKED"])).toBe("pending");
  expect(aggregateParcelStatus(["DELIVERED", "IN_TRANSIT"])).toBe("in_transit");
  expect(aggregateParcelStatus(["DELIVERED", "CANCELLED"])).toBe("failed_attempt");
  expect(aggregateParcelStatus(["DELIVERED", "DELIVERED"])).toBe("delivered");
});
it("requires the exact persisted quote plan, including every parcel's tokens and costs", () => {
  const rows = recorded();
  expect(splitPlanMatches(quote, rows as any)).toBe(true);
  for (const change of [
    { parcelIndex: 0 },
    { parcelIndex: 2 },
    { quoteId: "old-quote" },
    { requestToken: "changed" },
    { courierId: "other-courier" },
    { serviceCode: "other-service" },
    { amountMinor: 999n },
    { walletMinor: 999n },
  ]) expect(splitPlanMatches(quote, [rows[0]!, { ...rows[1], ...change }] as any)).toBe(false);
  expect(splitPlanMatches(quote, rows.slice(0, 1) as any)).toBe(false);
  expect(splitPlanMatches(quote, [...rows, rows[0]!] as any)).toBe(false);
});
it("recovers only a complete matching recorded booking without guessing missing actual cost", () => {
  const rows = recorded();
  expect(recordedSplitBooking("delivery", quote, rows as any)).toMatchObject({
    id: "split:delivery", shippingMinor: 2000n,
  });
  expect(recordedSplitBooking("delivery", quote, [rows[0]!, { ...rows[1], actualMinor: null }] as any)?.shippingMinor).toBeUndefined();
  expect(recordedSplitBooking("delivery", quote, [rows[0]!, { ...rows[1], providerShipmentId: null }] as any)).toBeNull();
  expect(recordedSplitBooking("delivery", quote, [rows[0]!, { ...rows[1], quoteId: "old" }] as any)).toBeNull();
});
it("flags each parcel's actual cost mismatch even when their total matches the quote", () => {
  const rows = recorded();
  rows[0]!.actualMinor = 900n;
  rows[1]!.actualMinor = 1100n;
  expect(recordedSplitBooking("delivery", quote, rows as any)).toMatchObject({ shippingMinor: 2000n, requiresReview: true });
});
it("rejects a changed persisted plan before any carrier write", async () => {
  h.rows = recorded().map((row) => ({ ...row, requestToken: "old-token" }));
  await expect(bookSplitDelivery({ book: h.book } as any, "delivery", quote)).rejects.toThrow("SPLIT_QUOTE_CHANGED");
  expect(h.book).not.toHaveBeenCalled();
});
it("rechecks funding and settlement before claiming each parcel", async () => {
  const check = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("settlement started"));
  h.book.mockResolvedValue({ id: "SB-first", courier: "Courier", status: "pending", shippingMinor: 1000n });
  await expect(bookSplitDelivery({ book: h.book } as any, "delivery", quote, check)).rejects.toThrow("settlement started");
  expect(check).toHaveBeenCalledTimes(2);
  expect(h.book).toHaveBeenCalledOnce();
  expect(h.rows[0].providerShipmentId).toBe("SB-first");
  expect(h.rows[1].status).toBe("PENDING");
});
it("cancels known labels once while retaining uncertainty for an unrecorded parcel", async () => {
  h.rows = recorded();
  h.rows[1].providerShipmentId = null;
  h.rows[1].status = "BOOKING_UNCERTAIN";
  h.track.mockImplementation(async (id) => ({ id, status: "cancelled" }));
  const provider = { track: h.track, cancel: h.cancel } as any;
  await expect(trackSplitDelivery(provider, "delivery", true)).rejects.toThrow("SPLIT_BOOKING_UNCERTAIN");
  expect(h.cancel).toHaveBeenCalledWith("SB-0");
  expect(h.rows[0].status).toBe("CANCELLED");
  expect(h.rows[1].status).toBe("BOOKING_UNCERTAIN");
  await expect(trackSplitDelivery(provider, "delivery", true)).rejects.toThrow("SPLIT_BOOKING_UNCERTAIN");
  expect(h.cancel).toHaveBeenCalledOnce();
});
it("cancels every known label despite a failed tracking read and never repeats cancellation", async () => {
  h.rows = recorded();
  h.track.mockImplementation(async (id) => {
    if (id === "SB-0") throw new Error("tracking timeout");
    return { id, status: "cancelled" };
  });
  const provider = { track: h.track, cancel: h.cancel } as any;
  await expect(trackSplitDelivery(provider, "delivery", true)).rejects.toThrow("tracking timeout");
  expect(h.cancel.mock.calls.map(([id]) => id)).toEqual(["SB-0", "SB-1"]);
  expect(h.rows[1].status).toBe("CANCELLED");
  h.track.mockImplementation(async (id) => ({ id, status: "cancelled" }));
  expect(await trackSplitDelivery(provider, "delivery", true)).toMatchObject({ status: "cancelled" });
  expect(h.cancel).toHaveBeenCalledTimes(2);
});
it("continues cancelling other labels after an ambiguous cancellation response", async () => {
  h.rows = recorded();
  h.cancel.mockRejectedValueOnce(new Error("cancellation timeout"));
  h.track.mockImplementation(async (id) => ({ id, status: "cancelled" }));
  const provider = { track: h.track, cancel: h.cancel } as any;
  await expect(trackSplitDelivery(provider, "delivery", true)).rejects.toThrow("cancellation timeout");
  expect(h.cancel.mock.calls.map(([id]) => id)).toEqual(["SB-0", "SB-1"]);
  expect(await trackSplitDelivery(provider, "delivery", true)).toMatchObject({ status: "cancelled" });
  expect(h.cancel).toHaveBeenCalledTimes(2);
});
it("preserves delayed tracking progress and rejects another shipment's response", async () => {
  h.rows = recorded().map((row) => ({ ...row, status: "IN_TRANSIT" }));
  h.track.mockImplementation(async (id) => ({ id, status: "picked_up" }));
  await trackSplitDelivery({ track: h.track } as any, "delivery");
  expect(h.rows.every((row) => row.status === "IN_TRANSIT")).toBe(true);
  h.track.mockResolvedValue({ id: "other-shipment", status: "delivered" });
  await expect(trackSplitDelivery({ track: h.track } as any, "delivery")).rejects.toThrow("SHIPMENT_MISMATCH");
  expect(h.rows.every((row) => row.status === "IN_TRANSIT")).toBe(true);
});
it("marks a mixed delivered/cancelled split for review, never as complete delivery", async () => {
  h.rows = recorded();
  h.track.mockImplementation(async (id) => ({ id, status: id === "SB-0" ? "delivered" : "cancelled" }));
  expect(await trackSplitDelivery({ track: h.track } as any, "delivery")).toMatchObject({
    status: "failed_attempt", requiresReview: true,
  });
});
