import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("../../config.js", () => ({ getConfig: () => config }));
const config = {
  MEDIA_STORAGE: "cloudinary",
  PRIVATE_STORAGE_ROOT: "",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
};
import { storeMedia, readMedia, deleteMedia, checkMediaConfiguration } from "./private-media.js";
beforeAll(async () => {
  config.PRIVATE_STORAGE_ROOT = await mkdtemp(join(tmpdir(), "leetlogic-media-"));
});
afterAll(async () => {
  await rm(config.PRIVATE_STORAGE_ROOT, { recursive: true, force: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  config.MEDIA_STORAGE = "cloudinary";
});
describe("private Cloudinary media", () => {
  it("uploads images and videos as authenticated assets and never stores credentials or public URLs", async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
      const form = options.body as FormData;
      expect(form.get("type")).toBe("authenticated");
      expect(form.get("overwrite")).toBe("false");
      expect(form.get("signature")).toMatch(/^[a-f0-9]{40}$/);
      expect(form.get("api_secret")).toBeNull();
      return Response.json({
        public_id: form.get("public_id"),
        resource_type: url.includes("/video/") ? "video" : "image",
        format: url.includes("/video/") ? "mp4" : "png",
      });
    });
    vi.stubGlobal("fetch", fetcher);
    for (const mime of ["image/png", "video/mp4"]) {
      const key = await storeMedia(Buffer.from("test"), mime, "unused");
      expect(key).toMatch(/^cloudinary:/);
      expect(key).not.toContain("test-secret");
      expect(key).not.toContain("https:");
    }
    expect(fetcher.mock.calls[1]![0]).toContain("/video/upload");
  });
  it("retrieves private media through a short-lived signed download and supports cleanup", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ public_id: "leetlogic/photo", resource_type: "image", format: "png" }),
      )
      .mockResolvedValueOnce(new Response("original"))
      .mockResolvedValueOnce(Response.json({ result: "ok" }));
    vi.stubGlobal("fetch", fetcher);
    const key = await storeMedia(Buffer.from("original"), "image/png", "unused");
    expect((await readMedia(key)).toString()).toBe("original");
    const url = new URL(fetcher.mock.calls[1]![0]);
    expect(url.searchParams.get("type")).toBe("authenticated");
    expect(
      Number(url.searchParams.get("expires_at")) - Number(url.searchParams.get("timestamp")),
    ).toBe(60);
    await deleteMedia(key);
    expect(fetcher.mock.calls[2]![0]).toContain("/image/destroy");
  });
  it("identifies rejected API keys without exposing the provider response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: "Invalid api_key private-key-value" } },
            { status: 401 },
          ),
        ),
    );
    const error = await storeMedia(Buffer.from("test"), "image/png", "unused").catch((e) => e);
    expect(error.code).toBe("MEDIA_CONFIGURATION_ERROR");
    expect(error.diagnostics).toMatchObject({
      provider: "cloudinary",
      operation: "upload",
      providerStatus: 401,
      reason: "INVALID_API_KEY",
    });
    expect(error.diagnostics.hint).toContain("root .env");
    expect(JSON.stringify(error)).not.toContain("private-key-value");
    expect(error.message).not.toContain("api_key");
  });
  it("distinguishes signature, rate-limit, format and timeout failures", async () => {
    for (const [status, message, code, reason] of [
      [401, "Invalid Signature secret-material", "MEDIA_CONFIGURATION_ERROR", "INVALID_SIGNATURE"],
      [429, "too many requests", "MEDIA_RATE_LIMITED", "RATE_LIMITED"],
      [400, "Invalid image file", "MEDIA_FORMAT_UNSUPPORTED", "INVALID_FILE"],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json({ error: { message } }, { status })),
      );
      await expect(storeMedia(Buffer.from("test"), "image/png", "unused")).rejects.toMatchObject({
        code,
        diagnostics: { reason, providerStatus: status },
      });
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Private timeout message", "TimeoutError")),
    );
    await expect(storeMedia(Buffer.from("test"), "image/png", "unused")).rejects.toMatchObject({
      code: "MEDIA_TIMEOUT",
      diagnostics: { reason: "TIMEOUT" },
    });
  });
  it("checks credentials without uploading a file", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(checkMediaConfiguration()).resolves.toMatchObject({
      provider: "cloudinary",
      status: "ok",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.cloudinary.com/v1_1/test-cloud/ping");
    expect(fetcher.mock.calls[0]![1].body).toBeUndefined();
  });
  it("preserves existing local files after switching storage, and rejects path traversal", async () => {
    config.MEDIA_STORAGE = "local";
    await storeMedia(Buffer.from("legacy"), "image/png", "farmer/photo");
    config.MEDIA_STORAGE = "cloudinary";
    expect((await readMedia("farmer/photo")).toString()).toBe("legacy");
    await expect(readMedia("../outside")).rejects.toMatchObject({ code: "DOCUMENT_UNAVAILABLE" });
  });
  it("does not fall back to local storage or leak provider errors after a cloud failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private credential details")));
    await expect(storeMedia(Buffer.from("test"), "image/png", "never-saved")).rejects.toMatchObject(
      { code: "MEDIA_UNAVAILABLE" },
    );
    config.MEDIA_STORAGE = "local";
    await expect(readMedia("never-saved")).rejects.toThrow();
  });
});
