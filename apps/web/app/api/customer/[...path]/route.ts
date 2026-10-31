import { NextRequest, NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 2592000,
};
// Coalesce parallel browser reads when the access cookie expires.
const refreshes = new Map<string, Promise<{ accessToken: string; refreshToken: string } | null>>();
function refreshSession(base: string, refreshToken: string) {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const existing = refreshes.get(key);
  if (existing) return existing;
  const pending = fetch(`${base}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  })
    .then(async (response) => {
      if (response.status === 401) return null;
      // A temporary refresh outage is not evidence that the customer's session is invalid.
      if (!response.ok) throw new Error("Session refresh unavailable");
      const tokens = await response.json();
      if (typeof tokens.accessToken !== "string" || typeof tokens.refreshToken !== "string")
        throw new Error("Invalid refresh response");
      return tokens;
    })
    .catch((error) => { refreshes.delete(key); throw error; });
  refreshes.set(key, pending);
  const timer = setTimeout(() => { if (refreshes.get(key) === pending) refreshes.delete(key); }, 15000);
  timer.unref();
  return pending;
}
export async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (
    path.some((x) => !/^[\w-]+$/.test(x)) ||
    ![
      "auth",
      "me",
      "orders",
      "translations",
      "listing-drafts",
      "listing-photos",
      "financial",
    ].includes(path[0])
  )
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  if (req.method !== "GET" && req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ error: { message: "Invalid request origin" } }, { status: 403 });
  const route = path.join("/");
  const base = process.env.ADMIN_API_URL || "http://localhost:3000";
  const device = req.cookies.get("ll_customer_device")?.value || randomUUID();
  let access = req.cookies.get("ll_customer_access")?.value;
  let refresh = req.cookies.get("ll_customer_refresh")?.value;
  let rotated = false;
  let body: string | ArrayBuffer | undefined;
  const contentType = req.headers.get("content-type") || "application/json";
  try {
    if (req.method !== "GET" && req.method !== "DELETE") {
      if (contentType.startsWith("image/")) {
        if (Number(req.headers.get("content-length")) > 10485760)
          return NextResponse.json({ error: { message: "Photo is too large" } }, { status: 413 });
        body = await req.arrayBuffer();
        if (body.byteLength > 10485760)
          return NextResponse.json({ error: { message: "Photo is too large" } }, { status: 413 });
      } else {
        let data = await req.json();
        if (route.startsWith("auth/otp/")) data = { ...data, deviceId: device };
        if (route === "auth/refresh") data = { refreshToken: refresh };
        body = JSON.stringify(data);
      }
    }
    const call = () =>
      fetch(`${base}/v1/${route}${req.nextUrl.search}`, {
        method: req.method,
        headers: {
          "Content-Type": contentType,
           ...(access ? { Authorization: `Bearer ${access}` } : {}),
           ...(req.headers.get("idempotency-key") ? { "Idempotency-Key": req.headers.get("idempotency-key")! } : {}),
        },
        ...(body ? { body } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(/\/delivery\/(quotes|refresh-quote)$/.test(route) ? 120000 : 30000),
      });
    let upstream = await call();
    if (upstream.status === 401 && refresh && !route.startsWith("auth/")) {
      const tokens = await refreshSession(base, refresh);
      if (tokens) {
        access = tokens.accessToken;
        refresh = tokens.refreshToken;
        rotated = true;
        upstream = await call();
      }
    }
    if (upstream.ok && upstream.headers.get("content-type")?.startsWith("image/")) {
      const result = new NextResponse(upstream.body, {
        headers: {
          "Content-Type": upstream.headers.get("content-type")!,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
      if (access) result.cookies.set("ll_customer_access", access, cookieOptions);
      if (refresh) result.cookies.set("ll_customer_refresh", refresh, cookieOptions);
      return result;
    }
    const data = upstream.status === 204 ? {} : await upstream.json();
    const { accessToken, refreshToken, ...safe } = data;
    const result =
      upstream.status === 204
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(safe, {
            status: upstream.status,
            headers: { "Cache-Control": "no-store" },
          });
    result.cookies.set("ll_customer_device", device, cookieOptions);
    if (accessToken || access)
      result.cookies.set("ll_customer_access", accessToken || access, cookieOptions);
    if (refreshToken || refresh)
      result.cookies.set("ll_customer_refresh", refreshToken || refresh, cookieOptions);
    if (route === "auth/logout" || upstream.status === 401)
      for (const name of ["ll_customer_access", "ll_customer_refresh"]) result.cookies.delete(name);
    return result;
  } catch {
    const result = NextResponse.json(
      { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Service unavailable. Please retry." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
    if (route === "auth/logout")
      for (const name of ["ll_customer_access", "ll_customer_refresh"]) result.cookies.delete(name);
    else if (rotated) {
      // Rotation consumed the old refresh token even if the subsequent read failed to connect/parse.
      result.cookies.set("ll_customer_access", access!, cookieOptions);
      result.cookies.set("ll_customer_refresh", refresh!, cookieOptions);
    }
    return result;
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
