import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, dirname } from "node:path";
import { z } from "zod";
import { getConfig } from "../../config.js";
import { AppError } from "../../lib/errors.js";
const assetSchema = z.object({
  id: z.string().regex(/^leetlogic\/[a-zA-Z0-9_./-]+$/),
  resource: z.enum(["image", "video", "raw"]),
  format: z.string().regex(/^[a-zA-Z0-9]+$/),
});
const prefix = "cloudinary:";
function credentials() {
  const c = getConfig();
  if (!c.CLOUDINARY_CLOUD_NAME || !c.CLOUDINARY_API_KEY || !c.CLOUDINARY_API_SECRET)
    throw new AppError(
      503,
      "MEDIA_UNAVAILABLE",
      "We can’t upload your file right now. Please try again later.",
    );
  return {
    cloud: c.CLOUDINARY_CLOUD_NAME,
    key: c.CLOUDINARY_API_KEY,
    secret: c.CLOUDINARY_API_SECRET,
  };
}
function sign(params: Record<string, string>, secret: string) {
  return createHash("sha1")
    .update(
      Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("&") + secret,
    )
    .digest("hex");
}
async function cloudRequest(
  resource: string,
  operation: string,
  params: Record<string, string>,
  file?: Buffer,
) {
  const c = credentials();
  const fields = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("api_key", c.key);
  form.set("signature", sign(fields, c.secret));
  if (file) form.set("file", new Blob([new Uint8Array(file)]), "media");
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/${resource}/${operation}`,
      { method: "POST", body: form, signal: AbortSignal.timeout(20000) },
    );
    if (!response.ok) throw new Error("Upload failed");
    return await response.json();
  } catch {
    throw new AppError(503, "MEDIA_UNAVAILABLE", "We couldn’t upload your file. Please try again.");
  }
}
export async function storeMedia(bytes: Buffer, mime: string, localKey: string) {
  if (getConfig().MEDIA_STORAGE !== "cloudinary") {
    const path = resolve(getConfig().PRIVATE_STORAGE_ROOT, localKey);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, bytes, { mode: 0o600, flag: "wx" });
    return localKey;
  }
  const resource = mime.startsWith("video/")
    ? "video"
    : mime === "application/pdf"
      ? "raw"
      : "image";
  const id = `leetlogic/${randomUUID()}${resource === "raw" ? ".pdf" : ""}`;
  const result = await cloudRequest(
    resource,
    "upload",
    { public_id: id, type: "authenticated", overwrite: "false" },
    bytes,
  );
  const parsed = z
    .object({
      public_id: z.string(),
      resource_type: z.enum(["image", "video", "raw"]),
      format: z.string().optional(),
    })
    .parse(result);
  // Store only an opaque locator, never the signed URL or credentials.
  return (
    prefix +
    Buffer.from(
      JSON.stringify({
        id: parsed.public_id,
        resource: parsed.resource_type,
        format: parsed.format || "pdf",
      }),
    ).toString("base64url")
  );
}
export async function readMedia(key: string): Promise<Buffer> {
  if (key.startsWith(prefix)) {
    const asset = assetSchema.parse(
      JSON.parse(Buffer.from(key.slice(prefix.length), "base64url").toString()),
    );
    const c = credentials();
    const params = {
      public_id: asset.id,
      format: asset.format,
      type: "authenticated",
      timestamp: String(Math.floor(Date.now() / 1000)),
      expires_at: String(Math.floor(Date.now() / 1000) + 60),
    };
    const query = new URLSearchParams({
      ...params,
      api_key: c.key,
      signature: sign(params, c.secret),
    });
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/${asset.resource}/download?${query}`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (!response.ok) throw new Error("Unavailable");
      return Buffer.from(await response.arrayBuffer());
    } catch {
      throw new AppError(503, "MEDIA_UNAVAILABLE", "We couldn’t open this file. Please try again.");
    }
  }
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(key) ||
    key.split("/").some((part) => part === ".." || part === ".")
  )
    throw new AppError(404, "DOCUMENT_UNAVAILABLE", "File not found");
  const base = await realpath(resolve(getConfig().PRIVATE_STORAGE_ROOT));
  const path = await realpath(resolve(base, key));
  if (!path.startsWith(base + sep))
    throw new AppError(404, "DOCUMENT_UNAVAILABLE", "File not found");
  return readFile(path);
}
export async function deleteMedia(key: string) {
  if (key.startsWith(prefix)) {
    const asset = assetSchema.parse(
      JSON.parse(Buffer.from(key.slice(prefix.length), "base64url").toString()),
    );
    await cloudRequest(asset.resource, "destroy", {
      public_id: asset.id,
      type: "authenticated",
      invalidate: "true",
    });
  } else await unlink(resolve(getConfig().PRIVATE_STORAGE_ROOT, key));
}
