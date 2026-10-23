import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { resolveApiUrl } from "./api-url";
export const API_URL = resolveApiUrl({
  explicitUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
  development: __DEV__,
});
if (__DEV__) console.info(`[LeetLogic API] ${API_URL}`);
type Session = { accessToken: string; refreshToken: string };
let session: Session | null = null;
let refresh: Promise<void> | null = null;
let devicePromise: Promise<string> | null = null;
export const uuid = () => Crypto.randomUUID();
export function deviceId() {
  return (devicePromise ??= (async () => {
    const prior = await SecureStore.getItemAsync("leetlogic-device");
    if (prior) return prior;
    const id = uuid();
    await SecureStore.setItemAsync("leetlogic-device", id);
    return id;
  })().catch(() => {
    devicePromise = null;
    throw new ApiError(
      0,
      "DEVICE_STORAGE_UNAVAILABLE",
      "Cannot access secure storage on this device. Restart the app and try again.",
    );
  }));
}
export async function hydrateSession() {
  const saved = await SecureStore.getItemAsync("leetlogic-session");
  if (saved) {
    try {
      session = JSON.parse(saved);
    } catch {
      await clearSession();
    }
  }
  return !!session;
}
export async function saveSession(value: Session) {
  await SecureStore.setItemAsync("leetlogic-session", JSON.stringify(value));
  session = value;
}
export async function clearSession() {
  session = null;
  await SecureStore.deleteItemAsync("leetlogic-session");
}
export class ApiError extends Error {
  requestId?: string;
  retryAfterSeconds?: number;
  constructor(
    public status: number,
    public code: string,
    message: string,
    details: { requestId?: string; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.requestId = details.requestId;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}
async function rotate() {
  if (!session) throw new ApiError(401, "SIGN_IN_REQUIRED", "Please sign in again.");
  const token = session.refreshToken;
  const r = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: token }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    if (r.status === 401) await clearSession();
    throw new ApiError(r.status, "SESSION_EXPIRED", "Please sign in again.");
  }
  const data = await r.json();
  if (session?.refreshToken === token) await saveSession(data);
}
export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; key?: string; blob?: Blob } = {},
): Promise<T> {
  const send = () =>
    fetch(`${API_URL}/v1${path}`, {
      method: options.method || "GET",
      headers: {
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(options.blob
          ? { "Content-Type": options.blob.type }
          : { "Content-Type": "application/json" }),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : options.blob
          ? { body: options.blob }
          : {}),
      signal: AbortSignal.timeout(options.blob ? 60000 : 25000),
    });
  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && session && !path.startsWith("/auth/")) {
      await (refresh ??= rotate().finally(() => {
        refresh = null;
      }));
      response = await send();
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const timeout = e instanceof Error && ["AbortError", "TimeoutError"].includes(e.name);
    throw new ApiError(
      0,
      timeout ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      timeout
        ? "This is taking longer than expected. Please try again."
        : "Unable to connect. Check your internet connection and try again.",
    );
  }
  let data;
  try {
    data = response.status === 204 ? null : await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "INVALID_SERVER_RESPONSE",
      "We couldn’t complete this action. Please try again or contact support if it continues.",
    );
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.error?.code || "REQUEST_FAILED",
      data?.error?.message || "Request failed. Please try again.",
      {
        requestId: data?.error?.requestId || response.headers.get("x-request-id") || undefined,
        retryAfterSeconds:
          data?.error?.retryAfterSeconds ??
          (response.headers.get("retry-after")
            ? Number(response.headers.get("retry-after"))
            : undefined),
      },
    );
  return data;
}

export const authHeaders = (): Record<string, string> =>
  session ? { Authorization: `Bearer ${session.accessToken}` } : {};
