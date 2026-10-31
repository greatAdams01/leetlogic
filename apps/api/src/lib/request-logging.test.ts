import { Writable } from "node:stream";
import pino from "pino";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma, Prisma } from "@leetlogic/database";
import { createApp } from "../app.js";

const records: Record<string, any>[] = [];
const stream = new Writable({
  write(chunk, _encoding, done) {
    records.push(JSON.parse(chunk.toString()));
    done();
  },
});
const app = createApp(pino({ level: "info" }, stream));
afterEach(() => {
  vi.restoreAllMocks();
  records.length = 0;
});
describe("request diagnostics", () => {
  it("reports database downtime with an actionable 503 and one safe structured error", async () => {
    vi.spyOn(prisma.translationEntry, "findMany").mockRejectedValue(
      new Prisma.PrismaClientInitializationError(
        "PRIVATE SQL and password=secret",
        "test",
        "P1001",
      ),
    );
    const result = await request(app)
      .get("/v1/content/translations?locale=en&token=private-query")
      .set("Authorization", "Bearer private-header");
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(result.headers["retry-after"]).toBe("5");
    expect(records).toHaveLength(1);
    expect(records[0]!.err.code).toBe("DATABASE_UNAVAILABLE");
    expect(records[0]!.err.hint).toContain("docker compose");
    expect(records[0]!.req.requestId).toBe(result.body.error.requestId);
    const logs = JSON.stringify(records);
    for (const secret of [
      "PRIVATE SQL",
      "password=secret",
      "private-query",
      "private-header",
      "failed with status code",
    ])
      expect(logs).not.toContain(secret);
  });
  it("reports a missing migration without masking it as a connection failure", async () => {
    vi.spyOn(prisma.translationEntry, "findMany").mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("private query", {
        code: "P2021",
        clientVersion: "test",
        meta: { modelName: "TranslationEntry", table: "public.translation_entries" },
      }),
    );
    const result = await request(app).get("/v1/content/translations?locale=ig");
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("DATABASE_SCHEMA_MISMATCH");
    expect(records[0]!.err.hint).toContain("migrations");
    expect(records[0]!.err.database).toEqual({ prismaCode: "P2021", model: "TranslationEntry", table: "public.translation_entries" });
    expect(result.body.error.message).toBe("Service is temporarily unavailable. Please try again.");
    expect(JSON.stringify(result.body)).not.toMatch(/Prisma|public\.translation_entries|database schema/i);
  });
  it("identifies a missing related column in server-only metadata, not in the public response", async () => {
    vi.spyOn(prisma.translationEntry, "findMany").mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("private SQL with a phone and OTP", {
        code: "P2022", clientVersion: "test",
        meta: { modelName: "User", column: "addresses.postcode_verified_at", query: "private payload" },
      }),
    );
    const result = await request(app).get("/v1/content/translations");
    expect(result.status).toBe(503);
    expect(records[0]!.err.database).toEqual({ prismaCode: "P2022", model: "User", column: "addresses.postcode_verified_at" });
    expect(JSON.stringify(result.body)).not.toMatch(/addresses|postcode|Prisma|P2022|private/);
    expect(JSON.stringify(records)).not.toMatch(/private SQL|private payload/);
  });
  it("rejects malformed database metadata rather than logging submitted values", async () => {
    vi.spyOn(prisma.translationEntry, "findMany").mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("private", {
        code: "P2022", clientVersion: "test",
        meta: { modelName: { secret: "private-model" }, column: "addresses.private-value\npassword=secret", table: "postgres://private" },
      }),
    );
    await request(app).get("/v1/content/translations");
    expect(records[0]!.err.database).toEqual({ prismaCode: "P2022" });
    expect(JSON.stringify(records)).not.toMatch(/private-model|private-value|password=secret|postgres:\/\//);
  });
  it("never includes submitted authentication codes or phone numbers in request logs", async () => {
    const result = await request(app).post("/v1/auth/otp/verify")
      .send({ phone: "+2348012345678", deviceId: "device", code: "678901", intent: "invalid" });
    expect(result.status).toBe(422);
    expect(JSON.stringify(records)).not.toMatch(/678901|2348012345678/);
  });
  it("reports Redis outages without leaking connection credentials", async () => {
    const error = new Error("redis://user:secret@host");
    error.name = "MaxRetriesPerRequestError";
    vi.spyOn(prisma.translationEntry, "findMany").mockRejectedValue(error);
    const result = await request(app).get("/v1/content/translations");
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("REDIS_UNAVAILABLE");
    expect(JSON.stringify(records)).not.toContain("redis://");
  });
  it("retains unexpected source frames while keeping internal messages out of logs and responses", async () => {
    const error = new TypeError("a private message or query value");
    vi.spyOn(prisma.translationEntry, "findMany").mockRejectedValue(error);
    const result = await request(app).get("/v1/content/translations");
    expect(result.status).toBe(500);
    expect(records[0]!.err.type).toBe("TypeError");
    expect(records[0]!.err.stack).toContain("at ");
    expect(JSON.stringify(records)).not.toContain(error.message);
    expect(result.body.error.message).toBe("An unexpected error occurred");
  });
  it("keeps a successful translations response and expected authorization errors distinguishable", async () => {
    vi.spyOn(prisma.translationEntry, "findMany").mockResolvedValue([]);
    const translated = await request(app).get("/v1/content/translations?locale=ig");
    expect(translated.status).toBe(200);
    expect(translated.body).toEqual({ locale: "ig", messages: {} });
    const unauthorized = await request(app).patch("/v1/me/locale").send({ locale: "ig" });
    expect(unauthorized.status).toBe(401);
    expect(records[1]!.err.code).toBe("AUTH_REQUIRED");
    expect(records[1]!.level).toBe(40);
  });
});
