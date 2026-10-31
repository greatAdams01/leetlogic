import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), update: vi.fn(), request: vi.fn(), verify: vi.fn(), session: vi.fn() }));
vi.mock("@leetlogic/database", async (original) => ({ ...await original<any>(), prisma: { user: { findUnique: h.find, create: h.create, update: h.update } } }));
vi.mock("../services/otp.js", () => ({ requestOtp: h.request, verifyOtp: h.verify }));
vi.mock("../services/sessions.js", () => ({ createSession: h.session, revokeAll: vi.fn(), revokeSession: vi.fn(), rotateSession: vi.fn() }));
import { authRouter } from "./auth.js";
import { errorHandler } from "../lib/errors.js";
const app = express(); app.use(express.json()); app.use("/auth", authRouter); app.use(errorHandler);
const body = { phone: "08012345678", deviceId: "test-device", code: "123456" };
const seller = { id: "seller", status: "ACTIVE", phoneE164: "+2348012345678", capabilities: [{ capability: "SELLER" }] };
beforeEach(() => { vi.resetAllMocks(); h.session.mockResolvedValue({ accessToken: "token" }); h.find.mockResolvedValue(seller); h.update.mockResolvedValue(seller); });
it("ignores a forged Buyer role during Seller login", async () => {
  const response = await request(app).post("/auth/otp/verify").send({ ...body, role: "BUYER" });
  expect(response.status).toBe(200); expect(response.body.user.role).toBe("SELLER");
  expect(h.session).toHaveBeenCalledWith(expect.objectContaining({ capabilities: ["SELLER"] }));
  expect(h.create).not.toHaveBeenCalled();
});
it("never creates an account through login", async () => {
  h.find.mockResolvedValue(null);
  expect((await request(app).post("/auth/otp/verify").send(body)).status).toBe(404);
  expect(h.create).not.toHaveBeenCalled(); expect(h.session).not.toHaveBeenCalled();
});
it("rejects duplicate registration before sending an OTP", async () => {
  const response = await request(app).post("/auth/otp/request").send({ ...body, intent: "REGISTER", role: "BUYER" });
  expect(response.status).toBe(409); expect(response.body.error.code).toBe("PHONE_ALREADY_REGISTERED");
  expect(h.request).not.toHaveBeenCalled();
});
it("registers the requested role only after OTP verification", async () => {
  h.find.mockResolvedValue(null); h.create.mockResolvedValue(seller);
  const response = await request(app).post("/auth/otp/verify").send({ ...body, intent: "REGISTER", role: "SELLER" });
  expect(response.status).toBe(200);
  expect(h.verify).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "test-device:REGISTER:SELLER" }));
  expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ capabilities: { create: { capability: "SELLER" } } }) }));
});
it("blocks ambiguous legacy roles and suspended accounts", async () => {
  for (const account of [{ ...seller, capabilities: [{ capability: "BUYER" }, { capability: "SELLER" }] }, { ...seller, status: "SUSPENDED" }]) {
    h.find.mockResolvedValue(account);
    expect((await request(app).post("/auth/otp/verify").send(body)).status).toBeGreaterThanOrEqual(400);
  }
  expect(h.session).not.toHaveBeenCalled();
});
it("handles concurrent duplicate registration with a login message", async () => {
  h.find.mockResolvedValue(null); h.create.mockRejectedValue({ code: "P2002" });
  const response = await request(app).post("/auth/otp/verify").send({ ...body, intent: "REGISTER", role: "SELLER" });
  expect(response.status).toBe(409); expect(response.body.error.code).toBe("PHONE_ALREADY_REGISTERED");
});
