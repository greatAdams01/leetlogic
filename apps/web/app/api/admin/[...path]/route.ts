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
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok && route.startsWith("verifications/documents/"))
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
          "Content-Disposition": 'inline; filename="verification-document"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox",
        },
      });
    const data = response.status === 204 ? {} : await response.json();
    const { accessToken, refreshToken, preAuthToken, ...safe } = data;
    const result =
      response.status === 204
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(safe, {
            status: response.status,
            headers: { "Cache-Control": "no-store" },
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
  } catch {
    return NextResponse.json(
      { error: { message: "Admin backend is unavailable. Please retry." } },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
