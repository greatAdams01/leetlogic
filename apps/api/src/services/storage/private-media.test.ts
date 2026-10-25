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
  it("retrieves authenticated originals through server-only signed delivery and supports cleanup", async () => {
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
    expect(url.origin).toBe("https://res.cloudinary.com");
    expect(url.pathname).toMatch(
      /^\/test-cloud\/image\/authenticated\/s--[A-Za-z0-9_-]+--\/v1\/leetlogic\/photo.png$/,
    );
    expect(url.search).toBe("");
    expect(url.toString()).not.toContain("test-key");
    expect(url.toString()).not.toContain("test-secret");
    await deleteMedia(key);
    expect(fetcher.mock.calls[2]![0]).toContain("/image/destroy");
  });
  it("signs video and raw document delivery without changing formats or exposing provider URLs", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response("private bytes"));
    vi.stubGlobal("fetch", fetcher);
    for (const asset of [
      { id: "leetlogic/video", resource: "video", format: "mp4" },
      { id: "leetlogic/document.pdf", resource: "raw", format: "pdf" },
    ]) {
      const key = "cloudinary:" + Buffer.from(JSON.stringify(asset)).toString("base64url");
      await readMedia(key);
      const url = new URL(fetcher.mock.calls.at(-1)![0]);
      expect(url.origin).toBe("https://res.cloudinary.com");
      expect(url.pathname).toContain(`/${asset.resource}/authenticated/s--`);
      expect(url.pathname).toContain(
        asset.resource === "raw" ? "/leetlogic/document.pdf" : "/leetlogic/video.mp4",
      );
      expect(url.pathname).not.toContain(".pdf.pdf");
      expect(url.search).toBe("");
    }
  });
  it("reports interrupted private downloads as file timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => {
          throw new DOMException("Aborted", "AbortError");
        },
      }),
    );
    const key =
      "cloudinary:" +
      Buffer.from(
        JSON.stringify({ id: "leetlogic/photo", resource: "image", format: "jpg" }),
      ).toString("base64url");
    await expect(readMedia(key)).rejects.toMatchObject({
      code: "MEDIA_DOWNLOAD_TIMEOUT",
      diagnostics: { operation: "download", reason: "TIMEOUT" },
    });
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
  it("recovers transient upload connection failures using one asset ID and no overwrite", async () => {
    const network = new TypeError("fetch failed", { cause: { code: "EAI_AGAIN" } });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(network)
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const form = init.body as FormData;
        return Response.json({
          public_id: form.get("public_id"),
          resource_type: "image",
          existing: true,
        });
      });
    vi.stubGlobal("fetch", fetcher);
    const key = await storeMedia(Buffer.from("test"), "image/jpeg", "unused");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![1].body).toBe(fetcher.mock.calls[1]![1].body);
    expect((fetcher.mock.calls[1]![1].body as FormData).get("overwrite")).toBe("false");
    const asset = JSON.parse(Buffer.from(key.slice("cloudinary:".length), "base64url").toString());
    expect(asset.format).toBe("jpg");
    expect(asset.id).toBe((fetcher.mock.calls[0]![1].body as FormData).get("public_id"));
  });
  it("stops after two failed connections and reports a safe actionable network cause", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(
        new TypeError("https://secret.example/private?key=secret", {
          cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const error = await storeMedia(Buffer.from("test"), "image/jpeg", "unused").catch(
      (error) => error,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(error.code).toBe("MEDIA_NETWORK_ERROR");
    expect(error.diagnostics.reason).toBe("NETWORK_ERROR");
    expect(error.diagnostics.hint).toContain("UND_ERR_CONNECT_TIMEOUT");
    expect(JSON.stringify(error)).not.toContain("secret.example");
    expect(error.message).not.toContain("secret");
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
      { code: "MEDIA_NETWORK_ERROR" },
    );
    config.MEDIA_STORAGE = "local";
    await expect(readMedia("never-saved")).rejects.toThrow();
  });
});
