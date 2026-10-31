import { randomInt, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { Writable } from "node:stream";
import pino from "pino";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, Prisma } from "@leetlogic/database";
import { createApp } from "../app.js";
import { redis } from "../lib/redis.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { ConsoleOtpProvider } from "../providers/otp.js";
import { createSession } from "../services/sessions.js";

const fault = vi.hoisted(() => ({ profileError: null as Error | null }));
vi.mock("@leetlogic/database", async (original) => {
  const database = await original<typeof import("@leetlogic/database")>();
  return { ...database, prisma: database.prisma.$extends({ query: { user: {
    findUnique({ args, query }) {
      if (fault.profileError && args.include?.addresses) {
        const error = fault.profileError;
        fault.profileError = null;
        throw error;
      }
      return query(args);
    },
  } } }) };
});

const suite = process.env.AUTH_INTEGRATION === "1" ? describe : describe.skip;
const phone = () => `+23480${randomInt(0, 100_000_000).toString().padStart(8, "0")}`;

suite("unified OTP login and authenticated profiles", () => {
  const records: Record<string, any>[] = [];
  const stream = new Writable({ write(chunk, _encoding, done) { records.push(JSON.parse(chunk.toString())); done(); } });
  const app = createServer(createApp(pino({ level: "info" }, stream)));
  const codes = new Map<string, string>();
  const customer = async (role: "BUYER" | "SELLER") => {
    const user = await prisma.user.create({ data: {
      phoneE164: phone(), preferredLocale: role === "SELLER" ? "ha" : "en",
      capabilities: { create: { capability: role } },
      profile: { create: { fullName: `Existing ${role}`, email: `${randomUUID()}@example.test` } },
    } });
    const address = await prisma.address.create({ data: {
      userId: user.id, label: role === "SELLER" ? "Farm" : "Home", state: "Lagos", lga: "Ikeja",
      city: "Lagos", line1: "24 Fixture Road", postalCode: "100001", isDefaultDelivery: role === "BUYER",
      isDefaultFarm: role === "SELLER",
    } });
    if (role === "SELLER") await prisma.farmerProfile.create({ data: {
      userId: user.id, farmName: "Existing farm", farmType: "CROP", verificationStatus: "APPROVED", primaryAddressId: address.id,
    } });
    return { ...user, addressId: address.id };
  };
  const login = async (value: string, extra: object = {}) => {
    const body = { phone: value, deviceId: randomUUID(), intent: "LOGIN", ...extra };
    const sent = await request(app).post("/v1/auth/otp/request").send(body);
    expect(sent.status).toBe(202);
    expect(sent.headers["cache-control"]).toBe("no-store");
    expect(sent.body).not.toHaveProperty("code");
    const code = codes.get(value)!;
    expect(code).toMatch(/^\d{6}$/);
    const verified = await request(app).post("/v1/auth/otp/verify").send({ ...body, code });
    expect(verified.status).toBe(200);
    expect(verified.headers["cache-control"]).toBe("no-store");
    return { tokens: verified.body, code, body };
  };
  const me = (token: string) => request(app).get("/v1/me").set("Authorization", `Bearer ${token}`);
  const safeLogs = (value: string, code: string, tokens: { accessToken: string; refreshToken: string }) => {
    const output = JSON.stringify(records);
    for (const secret of [value, code, tokens.accessToken, tokens.refreshToken]) expect(output).not.toContain(secret);
  };

  beforeAll(async () => {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema");
    if (!/^leetlogic_auth_integration_[a-f0-9]{12}$/.test(schema || "") || new URL(process.env.REDIS_URL!).pathname !== "/12")
      throw new Error("Use scripts/test-auth.mjs; never run authentication fixtures against the application schema.");
    app.listen(0, "127.0.0.1");
    await once(app, "listening");
    // Isolate rate counters and OTPs by run without flushing Redis or invalidating real sessions.
    redis().options.keyPrefix = `${schema}:`;
  });
  beforeEach(() => {
    fault.profileError = null;
    records.length = 0;
    codes.clear();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External providers are prohibited in authentication fixtures"));
    // Successful flows use real OTP hashing, validation, audit records, sessions and queries.
    vi.spyOn(ConsoleOtpProvider.prototype, "send").mockImplementation(async (value, code) => { codes.set(value, code); });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (app.listening) await new Promise<void>((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
    await redis().quit();
    await prisma.$disconnect();
  });

  it("requires authentication to read a profile", async () => {
    const response = await request(app).get("/v1/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it.each(["BUYER", "SELLER"] as const)("completes OTP request → verification → profile for an existing %s without changing its role", async (role) => {
    const user = await customer(role);
    const before = await prisma.user.count();
    const result = await login(user.phoneE164, { role: role === "SELLER" ? "BUYER" : "SELLER" });
    expect(result.tokens.user).toMatchObject({ id: user.id, role, capabilities: [role] });
    const response = await me(result.tokens.accessToken);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.user).toMatchObject({ id: user.id, phoneE164: user.phoneE164,
      profile: { fullName: `Existing ${role}` }, capabilities: [{ capability: role }],
      addresses: [{ id: user.addressId, postalCode: "100001", postcodeVerifiedAt: null, postcodeVerificationLevel: null, postcodeVerificationMode: null }],
    });
    expect(Boolean(response.body.user.farmerProfile)).toBe(role === "SELLER");
    expect(await prisma.user.count()).toBe(before);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: verifyAccessToken(result.tokens.accessToken, "customer").sessionId } });
    expect(session.refreshTokenHash).not.toBe(result.tokens.refreshToken);
    expect(session.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(session.revokedAt).toBeNull();
    expect(await prisma.otpEvent.count({ where: { outcome: "VERIFIED" } })).toBeGreaterThan(0);
    safeLogs(user.phoneE164, result.code, result.tokens);
  });
  it("rejects unknown login numbers without sending an OTP or creating an account", async () => {
    const value = phone();
    const before = await prisma.user.count();
    const response = await request(app).post("/v1/auth/otp/request").send({ phone: value, deviceId: randomUUID(), intent: "LOGIN" });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ACCOUNT_NOT_FOUND");
    expect(codes.size).toBe(0);
    expect(await prisma.user.count()).toBe(before);
    const verified = await request(app).post("/v1/auth/otp/verify").send({ phone: value, deviceId: randomUUID(), intent: "LOGIN", code: "123456" });
    expect(verified.status).toBe(400);
    expect(verified.body.error.code).toBe("OTP_EXPIRED");
    expect(await prisma.user.count()).toBe(before);
  });
  it("rejects an incorrect OTP without creating a session, then accepts the correct code", async () => {
    const user = await customer("BUYER");
    const body = { phone: user.phoneE164, deviceId: randomUUID(), intent: "LOGIN" };
    expect((await request(app).post("/v1/auth/otp/request").send(body)).status).toBe(202);
    const code = codes.get(user.phoneE164)!;
    const wrong = code === "000000" ? "000001" : "000000";
    const invalid = await request(app).post("/v1/auth/otp/verify").send({ ...body, code: wrong });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("OTP_INVALID");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    const valid = await request(app).post("/v1/auth/otp/verify").send({ ...body, code });
    expect(valid.status).toBe(200);
    expect((await me(valid.body.accessToken)).status).toBe(200);
  });
  it("consumes each OTP only once without breaking the established session", async () => {
    const user = await customer("BUYER");
    const result = await login(user.phoneE164);
    const repeated = await request(app).post("/v1/auth/otp/verify").send({ ...result.body, code: result.code });
    expect(repeated.status).toBe(400);
    expect(repeated.body.error.code).toBe("OTP_EXPIRED");
    expect((await me(result.tokens.accessToken)).status).toBe(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });
  it("handles expired codes without authenticating a user", async () => {
    const user = await customer("BUYER");
    const body = { phone: user.phoneE164, deviceId: randomUUID(), intent: "LOGIN" };
    expect((await request(app).post("/v1/auth/otp/request").send(body)).status).toBe(202);
    await redis().expire(`otp:CUSTOMER_LOGIN:${user.phoneE164}:${body.deviceId}:LOGIN:`, 0);
    const response = await request(app).post("/v1/auth/otp/verify").send({ ...body, code: codes.get(user.phoneE164) });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("OTP_EXPIRED");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it("keeps a verified session valid across a profile schema outage and a subsequent refresh", async () => {
    const user = await customer("SELLER");
    const result = await login(user.phoneE164);
    fault.profileError = new Prisma.PrismaClientKnownRequestError("private SQL", {
      code: "P2022", clientVersion: "test", meta: { modelName: "User", column: "addresses.postcode_verified_at" },
    });
    const unavailable = await me(result.tokens.accessToken);
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe("DATABASE_SCHEMA_MISMATCH");
    expect(unavailable.headers["retry-after"]).toBe("5");
    expect(JSON.stringify(unavailable.body)).not.toMatch(/Prisma|postcode_verified_at|private SQL|missing.*column/i);
    const sessionId = verifyAccessToken(result.tokens.accessToken, "customer").sessionId;
    expect((await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })).revokedAt).toBeNull();
    expect((await me(result.tokens.accessToken)).status).toBe(200);
    const refreshed = await request(app).post("/v1/auth/refresh").send({ refreshToken: result.tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect((await me(refreshed.body.accessToken)).body.user.id).toBe(user.id);
    safeLogs(user.phoneE164, result.code, refreshed.body);
    const replay = await request(app).post("/v1/auth/refresh").send({ refreshToken: result.tokens.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("REFRESH_TOKEN_REUSED");
    safeLogs(user.phoneE164, result.code, result.tokens);
  });
  it("keeps existing sessions functional and omits soft-deleted addresses", async () => {
    const user = await customer("BUYER");
    await prisma.address.create({ data: { userId: user.id, state: "Lagos", lga: "Ikeja", city: "Lagos", line1: "Deleted fixture", deletedAt: new Date() } });
    const tokens = await createSession({ subject: "CUSTOMER", principalId: user.id, deviceId: randomUUID(), capabilities: ["BUYER"] });
    const response = await me(tokens.accessToken);
    expect(response.status).toBe(200);
    expect(response.body.user.addresses).toHaveLength(1);
    expect(response.body.user.addresses[0].id).toBe(user.addressId);
  });
  it("blocks suspended accounts and revoked sessions", async () => {
    const user = await customer("SELLER");
    const tokens = await createSession({ subject: "CUSTOMER", principalId: user.id, deviceId: randomUUID() });
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    const requested = await request(app).post("/v1/auth/otp/request").send({ phone: user.phoneE164, deviceId: randomUUID() });
    expect(requested.status).toBe(403);
    expect(codes.size).toBe(0);
    expect((await me(tokens.accessToken)).status).toBe(401);
    const buyer = await customer("BUYER");
    const active = await login(buyer.phoneE164);
    expect((await request(app).post("/v1/auth/logout").set("Authorization", `Bearer ${active.tokens.accessToken}`)).status).toBe(204);
    expect((await me(active.tokens.accessToken)).status).toBe(401);
  });
  it.each(["BUYER", "SELLER"] as const)("creates a new %s only through explicitly verified registration", async (role) => {
    const value = phone();
    const body = { phone: value, deviceId: randomUUID(), intent: "REGISTER", role };
    expect((await request(app).post("/v1/auth/otp/request").send(body)).status).toBe(202);
    expect(await prisma.user.findUnique({ where: { phoneE164: value } })).toBeNull();
    const verified = await request(app).post("/v1/auth/otp/verify").send({ ...body, code: codes.get(value) });
    expect(verified.status).toBe(200);
    expect(verified.body.user.role).toBe(role);
    expect((await me(verified.body.accessToken)).status).toBe(200);
    const duplicate = await request(app).post("/v1/auth/otp/request").send(body);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("PHONE_ALREADY_REGISTERED");
  });
  it("does not infer or grant a buyer role to an account that needs role review", async () => {
    const user = await prisma.user.create({ data: { phoneE164: phone(), profile: { create: {} } } });
    const body = { phone: user.phoneE164, deviceId: randomUUID(), intent: "LOGIN", role: "BUYER" };
    const sent = await request(app).post("/v1/auth/otp/request").send(body);
    expect(sent.status).toBe(409);
    expect(sent.body.error.code).toBe("ACCOUNT_ROLE_CONFLICT");
    expect(codes.size).toBe(0);
    const tokens = await createSession({ subject: "CUSTOMER", principalId: user.id, deviceId: randomUUID(), capabilities: ["BUYER"] });
    const response = await me(tokens.accessToken);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ACCOUNT_ROLE_CONFLICT");
    expect(await prisma.userCapability.count({ where: { userId: user.id } })).toBe(0);
  });
  it("binds registration codes to both the intent and selected role", async () => {
    const value = phone();
    const body = { phone: value, deviceId: randomUUID(), intent: "REGISTER", role: "SELLER" };
    expect((await request(app).post("/v1/auth/otp/request").send(body)).status).toBe(202);
    const code = codes.get(value)!;
    for (const change of [{ intent: "LOGIN" }, { role: "BUYER" }]) {
      const response = await request(app).post("/v1/auth/otp/verify").send({ ...body, ...change, code });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("OTP_EXPIRED");
    }
    expect(await prisma.user.findUnique({ where: { phoneE164: value } })).toBeNull();
    const verified = await request(app).post("/v1/auth/otp/verify").send({ ...body, code });
    expect(verified.status).toBe(200);
    expect(verified.body.user.role).toBe("SELLER");
    expect((await me(verified.body.accessToken)).status).toBe(200);
  });
});
