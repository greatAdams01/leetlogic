import { setTimeout as delay } from "node:timers/promises";
import { v2 as cloudinary } from "cloudinary";
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
function credentials(operation: MediaOperation = "upload") {
  const c = getConfig();
  if (!c.CLOUDINARY_CLOUD_NAME || !c.CLOUDINARY_API_KEY || !c.CLOUDINARY_API_SECRET)
    throw failure(operation, "NOT_CONFIGURED");
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
type MediaOperation = "upload" | "download" | "destroy" | "ping";
function failure(
  operation: MediaOperation,
  reason: string,
  providerStatus?: number,
  networkCode?: string,
) {
  const configuration = [
    "INVALID_API_KEY",
    "INVALID_SIGNATURE",
    "INVALID_CLOUD",
    "ACCESS_DENIED",
    "NOT_CONFIGURED",
  ].includes(reason);
  const code = configuration
    ? "MEDIA_CONFIGURATION_ERROR"
    : reason === "NETWORK_ERROR"
      ? "MEDIA_NETWORK_ERROR"
      : reason === "RATE_LIMITED"
        ? "MEDIA_RATE_LIMITED"
        : reason === "TIMEOUT"
          ? operation === "download"
            ? "MEDIA_DOWNLOAD_TIMEOUT"
            : "MEDIA_TIMEOUT"
          : reason === "INVALID_FILE"
            ? "MEDIA_FORMAT_UNSUPPORTED"
            : "MEDIA_UNAVAILABLE";
  const message = configuration
    ? "File uploads are temporarily unavailable. Please contact support if this continues."
    : reason === "NETWORK_ERROR"
      ? "The upload service could not be reached. Please try again."
      : reason === "RATE_LIMITED"
        ? "File uploads are busy. Please wait a moment and try again."
        : reason === "TIMEOUT"
          ? operation === "download"
            ? "The private file took too long to open. Please retry."
            : "The file upload took too long. Check your connection and try again."
          : reason === "INVALID_FILE"
            ? "This file could not be processed. Choose another JPEG, PNG, PDF or MP4 file."
            : operation === "download"
              ? "We couldn’t open this file. Please try again."
              : "We couldn’t upload your file. Please try again.";
  const error = new AppError(reason === "INVALID_FILE" ? 422 : 503, code, message);
  error.diagnostics = {
    provider: "cloudinary",
    operation,
    providerStatus,
    reason,
    hint: configuration
      ? "Check the cloud name and API key/secret from the same Cloudinary product environment in root .env, then restart the API. Check that the key is enabled."
      : reason === "NETWORK_ERROR"
        ? `Check API server DNS, internet connectivity and outbound HTTPS to api.cloudinary.com.${networkCode ? ` Network code: ${networkCode}.` : ""}`
        : reason === "TIMEOUT"
          ? "Cloudinary did not respond before the upload deadline. Check connectivity and retry."
          : reason === "RATE_LIMITED"
            ? "Check Cloudinary account limits and retry after the cooldown."
            : reason === "INVALID_FILE"
              ? "The provider rejected the media format or file contents."
              : "Check Cloudinary service status and account upload limits.",
  };
  return error;
}
function providerFailure(operation: MediaOperation, status: number, payload: unknown) {
  const message =
    typeof (payload as any)?.error?.message === "string" ? (payload as any).error.message : "";
  // Classify, never log raw provider messages: they may contain API keys or signed parameters.
  const reason = /invalid api.?key|unknown api.?key/i.test(message)
    ? "INVALID_API_KEY"
    : /invalid signature|signature.*invalid/i.test(message)
      ? "INVALID_SIGNATURE"
      : /unknown cloud|invalid cloud|cloud.?name.*(?:invalid|not found)/i.test(message)
        ? "INVALID_CLOUD"
        : status === 401 || status === 403
          ? "ACCESS_DENIED"
          : status === 429
            ? "RATE_LIMITED"
            : status === 400 &&
                /invalid (?:image|video|file)|unsupported|file format|image file/i.test(message)
              ? "INVALID_FILE"
              : "PROVIDER_REJECTED";
  return failure(operation, reason, status);
}
function safeNetworkCode(error: unknown): string | undefined {
  const item = error as { code?: string; cause?: unknown; errors?: unknown[] } | null;
  if (!item || typeof item !== "object") return;
  if (
    typeof item.code === "string" &&
    /^(?:E[A-Z0-9_]{1,40}|UND_ERR_[A-Z0-9_]{1,40})$/.test(item.code)
  )
    return item.code;
  if (item.cause && item.cause !== error) return safeNetworkCode(item.cause);
  return item.errors?.map(safeNetworkCode).find(Boolean);
}
async function sendCloud(url: string, operation: MediaOperation, options: RequestInit) {
  // Upload retries reuse the exact public_id, signature and overwrite=false form.
  // An accepted request with a lost response cannot create a second asset.
  const attempts = operation === "upload" ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const deadline = AbortSignal.timeout(operation === "download" ? 60000 : 20000);
    try {
      return await fetch(url, { ...options, signal: deadline });
    } catch (error) {
      if (attempt + 1 < attempts) {
        await delay(500);
        continue;
      }
      throw failure(
        operation,
        deadline.aborted ||
          (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
          ? "TIMEOUT"
          : "NETWORK_ERROR",
        undefined,
        safeNetworkCode(error),
      );
    }
  }
  throw failure(operation, "NETWORK_ERROR");
}
async function cloudRequest(
  resource: string,
  operation: "upload" | "destroy",
  params: Record<string, string>,
  file?: Buffer,
) {
  const c = credentials(operation);
  const fields = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("api_key", c.key);
  form.set("signature", sign(fields, c.secret));
  if (file) form.set("file", new Blob([new Uint8Array(file)]), "media");
  const response = await sendCloud(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/${resource}/${operation}`,
    operation,
    { method: "POST", body: form },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) throw providerFailure(operation, response.status, result);
  if (!result || typeof result !== "object" || result.error)
    throw failure(operation, "INVALID_RESPONSE", response.status);
  return result;
}
/** Read-only credential check. No assets are uploaded and no provider text is returned. */
export async function checkMediaConfiguration() {
  const c = credentials("ping");
  const response = await sendCloud(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloud)}/ping`,
    "ping",
    {
      headers: { Authorization: `Basic ${Buffer.from(`${c.key}:${c.secret}`).toString("base64")}` },
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) throw providerFailure("ping", response.status, result);
  if (result?.status !== "ok") throw failure("ping", "INVALID_RESPONSE", response.status);
  return { provider: "cloudinary", status: "ok", storage: getConfig().MEDIA_STORAGE };
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
        format:
          parsed.format ||
          (mime === "image/jpeg"
            ? "jpg"
            : mime === "image/png"
              ? "png"
              : mime === "video/quicktime"
                ? "mov"
                : mime === "video/mp4"
                  ? "mp4"
                  : "pdf"),
      }),
    ).toString("base64url")
  );
}
export async function readMedia(key: string): Promise<Buffer> {
  if (key.startsWith(prefix)) {
    const asset = assetSchema.parse(
      JSON.parse(Buffer.from(key.slice(prefix.length), "base64url").toString()),
    );
    const c = credentials("download");
    // Keep the signed delivery URL on the server. Browsers receive only the
    // authenticated app response, never a reusable Cloudinary capability URL.
    const url = cloudinary.url(asset.id, {
      cloud_name: c.cloud,
      api_secret: c.secret,
      secure: true,
      sign_url: true,
      analytics: false,
      resource_type: asset.resource,
      type: "authenticated",
      ...(asset.resource === "raw" ? {} : { format: asset.format }),
    });
    const response = await sendCloud(url, "download", {});
    if (!response.ok)
      throw providerFailure("download", response.status, await response.json().catch(() => null));
    try {
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw failure(
        "download",
        error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
          ? "TIMEOUT"
          : "NETWORK_ERROR",
      );
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
