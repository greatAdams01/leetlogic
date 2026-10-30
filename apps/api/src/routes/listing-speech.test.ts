import express from "express";
import request from "supertest";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({
  config: {
    LISTING_ASR_ENABLED: true,
    LISTING_ASR_URL: "http://127.0.0.1:8091",
    LISTING_ASR_TOKEN: "private-service-token",
  },
  limit: vi.fn(),
}));
vi.mock("../config.js", () => ({ getConfig: () => h.config }));
vi.mock("../lib/redis.js", () => ({ redis: () => ({ eval: h.limit }) }));
vi.mock("../middleware/auth.js", () => ({
  requireAuth: () => (req: any, res: any, next: any) => {
    if (req.get("Authorization") !== "Bearer customer-session") return res.sendStatus(401);
    req.auth = { sub: "farmer" };
    next();
  },
}));
import { listingSpeechRouter } from "./listing-speech.js";
import { errorHandler } from "../lib/errors.js";
const app = express();
app.use("/voice", listingSpeechRouter);
app.use(errorHandler);
const fetchMock = vi.fn();
const audio = Buffer.from("RIFF" + "a".repeat(64));
const send = () =>
  request(app)
    .post("/voice/transcribe?language=en")
    .set("Authorization", "Bearer customer-session")
    .set("Content-Type", "audio/wav")
    .send(audio);
beforeEach(() => {
  h.config.LISTING_ASR_ENABLED = true;
  h.limit.mockResolvedValue(1);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
it("requires authentication before health checks or audio forwarding", async () => {
  expect((await request(app).get("/voice/capabilities")).status).toBe(401);
  expect(
    (
      await request(app)
        .post("/voice/transcribe?language=en")
        .set("Content-Type", "audio/wav")
        .send(audio)
    ).status,
  ).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("reports disabled without contacting the worker when not configured", async () => {
  h.config.LISTING_ASR_ENABLED = false;
  expect(
    (await request(app).get("/voice/capabilities").set("Authorization", "Bearer customer-session"))
      .body.enabled,
  ).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("forwards binary audio with only the backend service credential and returns the transcript", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ text: " twenty five ", language: "en" }), { status: 200 }),
  );
  const result = await send();
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ text: "twenty five", language: "en" });
  expect(fetchMock).toHaveBeenCalledWith(
    "http://127.0.0.1:8091/transcribe?language=en",
    expect.objectContaining({
      headers: { Authorization: "Bearer private-service-token", "Content-Type": "audio/wav" },
      body: new Uint8Array(audio),
    }),
  );
  expect(JSON.stringify(result.body)).not.toContain("token");
});
it("maps decoder errors without returning internal worker details", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ error: "secret internal decoder path" }), { status: 422 }),
  );
  const result = await send();
  expect(result.status).toBe(422);
  expect(result.body.error.code).toBe("INVALID_AUDIO");
  expect(JSON.stringify(result.body)).not.toContain("secret");
});
it("limits repeated requests before forwarding", async () => {
  h.limit.mockResolvedValue(31);
  expect((await send()).status).toBe(429);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects oversized uploads and unsupported languages", async () => {
  const big = await request(app)
    .post("/voice/transcribe?language=en")
    .set("Authorization", "Bearer customer-session")
    .set("Content-Type", "audio/wav")
    .send(Buffer.alloc(2 * 1024 * 1024 + 1));
  expect(big.status).toBe(413);
  expect(
    (
      await request(app)
        .post("/voice/transcribe?language=ig")
        .set("Authorization", "Bearer customer-session")
        .set("Content-Type", "audio/wav")
        .send(audio)
    ).status,
  ).toBe(422);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("keeps worker downtime actionable", async () => {
  fetchMock.mockRejectedValue(new Error("connection refused with sensitive details"));
  const result = await send();
  expect(result.status).toBe(503);
  expect(result.body.error.code).toBe("VOICE_UNAVAILABLE");
  expect(JSON.stringify(result.body)).not.toContain("sensitive");
});
