import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  paidOrderNotification: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  mobilePushDevice: { findMany: vi.fn(), deleteMany: vi.fn() },
  session: { findFirst: vi.fn() },
}));
vi.mock("@leetlogic/database", () => ({ prisma: db }));
import { sendPaidOrderNotifications } from "./order-notifications.js";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  db.paidOrderNotification.findMany.mockResolvedValue([
    { id: "notice", userId: "farmer", orderId: "paid-order" },
  ]);
  db.paidOrderNotification.updateMany.mockResolvedValue({ count: 1 });
  db.mobilePushDevice.findMany.mockResolvedValue([
    { token: "ExpoPushToken[device]", sessionFamilyId: "family" },
  ]);
  db.session.findFirst.mockResolvedValue({ id: "active-session" });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { status: "ok" } }) });
});
afterEach(() => vi.unstubAllGlobals());
describe("paid order push outbox", () => {
  it("targets the farmer's active device and includes an account-scoped order link", async () => {
    await sendPaidOrderNotifications();
    expect(db.mobilePushDevice.findMany).toHaveBeenCalledWith({ where: { userId: "farmer" } });
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.data).toEqual({ kind: "paid-order", orderId: "paid-order", userId: "farmer" });
    expect(db.paidOrderNotification.update).toHaveBeenCalledWith({
      where: { id: "notice" },
      data: { sentAt: expect.any(Date) },
    });
  });
  it("does not send to a signed-out session", async () => {
    db.session.findFirst.mockResolvedValue(null);
    await sendPaidOrderNotifications();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not send when another worker already claimed the notification", async () => {
    db.paidOrderNotification.updateMany.mockResolvedValue({ count: 0 });
    await sendPaidOrderNotifications();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("leaves gateway failures for retry without affecting payment", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    await expect(sendPaidOrderNotifications()).resolves.toBeUndefined();
    expect(db.paidOrderNotification.update).not.toHaveBeenCalled();
  });
  it("removes unregistered tokens without retrying them", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "error", details: { error: "DeviceNotRegistered" } } }),
    });
    await sendPaidOrderNotifications();
    expect(db.mobilePushDevice.deleteMany).toHaveBeenCalledWith({
      where: { token: "ExpoPushToken[device]", sessionFamilyId: "family" },
    });
  });
});
