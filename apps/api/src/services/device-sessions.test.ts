import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  session: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@leetlogic/database", () => ({ prisma: db }));
import { activePhones, signOutPhone } from "./device-sessions.js";
beforeEach(() => vi.resetAllMocks());
describe("customer device sessions", () => {
  it("counts phones once and retains the actual current session", async () => {
    db.session.findMany.mockResolvedValue([
      { id: "new", deviceId: "phone-a" },
      { id: "current", deviceId: "phone-a" },
      { id: "other", deviceId: "phone-b" },
    ]);
    expect(await activePhones("farmer", "current")).toEqual([
      expect.objectContaining({ id: "current", current: true }),
      expect.objectContaining({ id: "other", current: false }),
    ]);
    expect(db.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "farmer",
          subject: "CUSTOMER",
          revokedAt: null,
          replacedById: null,
          expiresAt: { gt: expect.any(Date) },
        }),
      }),
    );
  });
  it("cannot revoke another account's session", async () => {
    db.session.findFirst.mockResolvedValueOnce({ deviceId: "mine" }).mockResolvedValueOnce(null);
    await expect(signOutPhone("farmer", "current", "outsider")).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
    expect(db.session.updateMany).not.toHaveBeenCalled();
  });
  it("protects the current phone even if it has more than one session", async () => {
    db.session.findFirst.mockResolvedValue({ deviceId: "mine" });
    await expect(signOutPhone("farmer", "current", "same-phone")).rejects.toMatchObject({
      code: "CURRENT_PHONE",
    });
    expect(db.session.updateMany).not.toHaveBeenCalled();
  });
  it("revokes all refresh families on the selected phone for the authenticated account", async () => {
    db.session.findFirst
      .mockResolvedValueOnce({ deviceId: "mine" })
      .mockResolvedValueOnce({ deviceId: "other" });
    await signOutPhone("farmer", "current", "target");
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "farmer", subject: "CUSTOMER", deviceId: "other", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

it("uses the latest real activity across all sessions on the same device", async () => {
  const older = new Date("2026-10-28T10:00:00Z");
  const latest = new Date("2026-10-29T10:00:00Z");
  db.session.findMany.mockResolvedValue([
    { id: "newer-login", deviceId: "phone-a", lastUsedAt: older, deviceName: "Old name" },
    {
      id: "current",
      deviceId: "phone-a",
      lastUsedAt: latest,
      deviceName: "Actual device",
      devicePlatform: "android",
    },
  ]);
  expect(await activePhones("farmer", "current")).toEqual([
    expect.objectContaining({
      id: "current",
      current: true,
      lastUsedAt: latest,
      deviceName: "Actual device",
      platform: "android",
    }),
  ]);
});
