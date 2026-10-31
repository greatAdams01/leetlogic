import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@leetlogic/database", () => ({ prisma: { session: { findUnique: h.session, updateMany: vi.fn() } } }));
vi.mock("../lib/tokens.js", () => ({ verifyAccessToken: () => ({ sub: "user", sessionId: "session", capabilities: ["BUYER"] }) }));
import { requireAuth, requireRole } from "./auth.js";
beforeEach(() => { vi.clearAllMocks(); });
it("replaces stale token permissions with the database role and denies buyer operations", async () => {
  h.session.mockResolvedValue({ userId: "user", user: { status: "ACTIVE", capabilities: [{ capability: "SELLER" }] }, expiresAt: new Date(Date.now() + 60000), lastUsedAt: new Date() });
  const req = { get: () => undefined, headers: { authorization: "Bearer token" } } as any;
  const next = vi.fn();
  await requireAuth("customer")(req, {} as any, next);
  expect(next).toHaveBeenCalledWith(); expect(req.auth.capabilities).toEqual(["SELLER"]);
  const denied = vi.fn(); requireRole("BUYER")(req, {} as any, denied);
  expect(denied).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
});
it("blocks existing sessions with ambiguous database roles", async () => {
  h.session.mockResolvedValue({ userId: "user", user: { status: "ACTIVE", capabilities: [{ capability: "BUYER" }, { capability: "SELLER" }] }, expiresAt: new Date(Date.now() + 60000) });
  const next = vi.fn();
  await requireAuth("customer")({ headers: { authorization: "Bearer token" } } as any, {} as any, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_ROLE_CONFLICT" }));
});
