import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handle } from "../app/api/customer/[...path]/route";

const fetcher = vi.fn();
const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });
const req = (path = "me", cookie = "ll_customer_access=old-access; ll_customer_refresh=valid-refresh", method = "GET") => new NextRequest(`http://localhost:3001/api/customer/${path}`, {
  method, headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
  ...(method === "GET" ? {} : { body: JSON.stringify({ phone: "08012345678", code: "123456" }) }),
});
beforeEach(() => { fetcher.mockReset(); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("keeps HttpOnly tokens out of the browser response after OTP verification", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ accessToken: "private-access", refreshToken: "private-refresh", user: { role: "SELLER" } }));
  const response = await handle(req("auth/otp/verify", "", "POST"), context("auth/otp/verify"));
  expect(await response.json()).toEqual({ user: { role: "SELLER" } });
  for (const name of ["ll_customer_access", "ll_customer_refresh"]) {
    expect(response.cookies.get(name)?.httpOnly).toBe(true);
    expect(response.cookies.get(name)?.sameSite).toBe("strict");
  }
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("uses Secure cookies for production authentication", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.resetModules();
  const production = await import("../app/api/customer/[...path]/route");
  fetcher.mockResolvedValueOnce(Response.json({ accessToken: "private-access", refreshToken: "private-refresh" }));
  const response = await production.handle(req("auth/otp/verify", "", "POST"), context("auth/otp/verify"));
  expect(response.cookies.get("ll_customer_access")?.secure).toBe(true);
  expect(response.cookies.get("ll_customer_refresh")?.secure).toBe(true);
});
it("preserves existing cookies when /me returns a temporary schema failure", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ error: { code: "DATABASE_SCHEMA_MISMATCH", message: "Service unavailable" } }, { status: 503 }));
  const response = await handle(req(), context("me"));
  expect(response.status).toBe(503);
  expect(response.cookies.get("ll_customer_access")?.value).toBe("old-access");
  expect(response.cookies.get("ll_customer_refresh")?.value).toBe("valid-refresh");
});
it.each(["http", "network"])("does not erase a valid session when access is expired and refresh has a temporary %s failure", async (mode) => {
  fetcher.mockResolvedValueOnce(Response.json({ error: { code: "SESSION_EXPIRED" } }, { status: 401 }));
  if (mode === "http") fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }));
  else fetcher.mockRejectedValueOnce(new Error("PRIVATE connection details"));
  const response = await handle(req("me", `ll_customer_access=expired; ll_customer_refresh=refresh-${mode}`), context("me"));
  expect(response.status).toBe(503);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await response.json()).toEqual({ error: { code: "DEPENDENCY_UNAVAILABLE", message: "Service unavailable. Please retry." } });
});
it("retains newly rotated cookies even if the subsequent profile read is unavailable", async () => {
  fetcher.mockResolvedValueOnce(Response.json({}, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ accessToken: "renewed-access", refreshToken: "renewed-refresh" }))
    .mockResolvedValueOnce(Response.json({ error: { code: "DATABASE_UNAVAILABLE" } }, { status: 503 }));
  const response = await handle(req("me", "ll_customer_access=expired; ll_customer_refresh=refresh-then-profile-outage"), context("me"));
  expect(response.status).toBe(503);
  expect(response.cookies.get("ll_customer_access")?.value).toBe("renewed-access");
  expect(response.cookies.get("ll_customer_refresh")?.value).toBe("renewed-refresh");
  expect(fetcher.mock.calls[2]![1].headers.Authorization).toBe("Bearer renewed-access");
});
it("clears cookies only when the refresh endpoint actually rejects the session", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ error: { code: "SESSION_EXPIRED" } }, { status: 401 }))
    .mockResolvedValueOnce(Response.json({}, { status: 401 }));
  const response = await handle(req("me", "ll_customer_access=expired; ll_customer_refresh=rejected-refresh"), context("me"));
  expect(response.status).toBe(401);
  expect(response.cookies.get("ll_customer_access")?.value).toBe("");
  expect(response.cookies.get("ll_customer_refresh")?.value).toBe("");
});
it.each(["network", "invalid-json"])("keeps rotated tokens when the next profile read fails with %s", async (mode) => {
  fetcher.mockResolvedValueOnce(Response.json({}, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ accessToken: "renewed-access", refreshToken: "renewed-refresh" }));
  if (mode === "network") fetcher.mockRejectedValueOnce(new Error("PRIVATE connection details"));
  else fetcher.mockResolvedValueOnce(new Response("PRIVATE invalid JSON"));
  const response = await handle(req("me", `ll_customer_access=expired; ll_customer_refresh=rotated-${mode}`), context("me"));
  expect(response.status).toBe(503);
  expect(response.cookies.get("ll_customer_access")?.value).toBe("renewed-access");
  expect(response.cookies.get("ll_customer_refresh")?.value).toBe("renewed-refresh");
  expect(JSON.stringify(await response.json())).not.toMatch(/PRIVATE|renewed-access|renewed-refresh/);
});
it("clears local cookies on explicit logout even when the API cannot be reached", async () => {
  fetcher.mockRejectedValueOnce(new Error("PRIVATE backend failure"));
  const response = await handle(req("auth/logout", undefined, "POST"), context("auth/logout"));
  expect(response.status).toBe(503);
  expect(response.cookies.get("ll_customer_access")?.value).toBe("");
  expect(response.cookies.get("ll_customer_refresh")?.value).toBe("");
  expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");
});
it("coalesces parallel profile reads so the same refresh token is rotated only once", async () => {
  fetcher.mockImplementation(async (url: string, options: { headers: { Authorization?: string } }) => {
    if (url.endsWith("/auth/refresh")) return Response.json({ accessToken: "parallel-access", refreshToken: "parallel-refresh" });
    return options.headers.Authorization === "Bearer parallel-access"
      ? Response.json({ user: { id: "existing-account" } })
      : Response.json({ error: { code: "SESSION_EXPIRED" } }, { status: 401 });
  });
  const cookie = "ll_customer_access=expired; ll_customer_refresh=coalesced-refresh";
  const responses = await Promise.all([handle(req("me", cookie), context("me")), handle(req("me", cookie), context("me"))]);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  for (const response of responses) {
    expect(response.status).toBe(200);
    expect(response.cookies.get("ll_customer_refresh")?.value).toBe("parallel-refresh");
    expect(await response.json()).toEqual({ user: { id: "existing-account" } });
  }
});
