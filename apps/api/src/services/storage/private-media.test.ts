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
import { storeMedia, readMedia, deleteMedia } from "./private-media.js";
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
