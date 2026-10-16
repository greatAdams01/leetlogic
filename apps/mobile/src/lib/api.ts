import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000")
).replace(/\/$/, "");
if (!__DEV__ && !API_URL.startsWith("https://"))
  throw new Error("Production API URL must use HTTPS.");
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
  })());
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
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
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
      signal: AbortSignal.timeout(25000),
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
    throw new Error("Cannot reach LeetLogic. Check your connection and try again.");
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.error?.code || "REQUEST_FAILED",
      data?.error?.message || "Request failed. Please try again.",
    );
  return data;
}

export const authHeaders = (): Record<string, string> =>
  session ? { Authorization: `Bearer ${session.accessToken}` } : {};
