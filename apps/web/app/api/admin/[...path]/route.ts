import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const upstream = process.env.ADMIN_API_URL || "http://localhost:3000";
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 28800,
};
async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((part) => !/^[a-zA-Z0-9-]+$/.test(part)))
    return NextResponse.json({ error: { message: "Invalid path" } }, { status: 400 });
  if (req.method !== "GET" && req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ error: { message: "Invalid request origin" } }, { status: 403 });
  const route = path.join("/");
  const privateMedia =
    route.startsWith("verifications/documents/") || route.startsWith("produce-photos/");
  const requestId = randomUUID();
  // The API's storage request can take 20s; allow it to return its precise error.
  const deadline = AbortSignal.timeout(privateMedia ? 35000 : 15000);
  const deviceId = req.cookies.get("ll_admin_device")?.value || randomUUID();
  const access = req.cookies.get("ll_admin_access")?.value;
  let body: Record<string, unknown> | undefined;
  if (req.method !== "GET" && req.method !== "DELETE") {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
    }
    if (route.startsWith("auth/")) {
      body = { ...body, deviceId };
      if (
        (route.startsWith("auth/totp/") || route === "auth/recovery") &&
        route !== "auth/totp/step-up"
      )
        body.preAuthToken = req.cookies.get("ll_admin_challenge")?.value;
    }
  }
  if (route === "auth/refresh") body = { refreshToken: req.cookies.get("ll_admin_refresh")?.value };
  try {
    const response = await fetch(`${upstream}/v1/admin/${route}${req.nextUrl.search}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: deadline,
    });
    if (response.ok && privateMedia)
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "X-Request-Id": response.headers.get("X-Request-Id") || requestId,
          "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
          "Content-Disposition": 'inline; filename="verification-document"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox",
        },
      });
    const data = response.status === 204 ? {} : await response.json().catch(() => null);
    if (!data || typeof data !== "object") {
      console.error(
        JSON.stringify({
          event: "admin_proxy_error",
          code: "ADMIN_INVALID_RESPONSE",
          requestId,
          route,
          status: response.status,
        }),
      );
      return NextResponse.json(
        {
          error: {
            code: "ADMIN_INVALID_RESPONSE",
            message: "The admin service returned an unreadable response. Please retry.",
            requestId,
          },
        },
        { status: 502, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
      );
    }
    const { accessToken, refreshToken, preAuthToken, ...safe } = data;
    const result =
      response.status === 204
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(safe, {
            status: response.status,
            headers: {
              "Cache-Control": "no-store",
              "X-Request-Id": response.headers.get("X-Request-Id") || requestId,
            },
          });
    result.cookies.set("ll_admin_device", deviceId, options);
    if (accessToken) result.cookies.set("ll_admin_access", accessToken, options);
    if (refreshToken) {
      result.cookies.set("ll_admin_refresh", refreshToken, options);
      result.cookies.delete("ll_admin_challenge");
    }
    if (preAuthToken) {
      result.cookies.delete("ll_admin_access");
      result.cookies.delete("ll_admin_refresh");
    }
    if (preAuthToken)
      result.cookies.set("ll_admin_challenge", preAuthToken, { ...options, maxAge: 300 });
    if (route === "auth/logout")
      for (const name of ["ll_admin_access", "ll_admin_refresh", "ll_admin_challenge"])
        result.cookies.delete(name);
    return result;
  } catch (error) {
    const timedOut =
      deadline.aborted ||
      (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name));
    const code = timedOut
      ? privateMedia
        ? "ADMIN_MEDIA_TIMEOUT"
        : "ADMIN_BACKEND_TIMEOUT"
      : "ADMIN_BACKEND_UNAVAILABLE";
    const message = timedOut
      ? privateMedia
        ? "The private file took too long to open. Please retry."
        : "The admin service took too long to respond. Please retry."
      : "Cannot connect to the admin service. Please check that the backend is running.";
    console.error(
      JSON.stringify({ event: "admin_proxy_error", code, requestId, route, method: req.method }),
    );
    return NextResponse.json(
      { error: { code, message, requestId } },
      {
        status: timedOut ? 504 : 503,
        headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
      },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
