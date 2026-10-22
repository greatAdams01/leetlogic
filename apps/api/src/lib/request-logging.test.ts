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
      }),
    );
    const result = await request(app).get("/v1/content/translations?locale=ig");
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("DATABASE_SCHEMA_MISMATCH");
    expect(records[0]!.err.hint).toContain("migrations");
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
