import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/admin/[...path]/route";
const filePath = ["verifications", "documents", "11111111-1111-4111-8111-111111111111"];
function get(path = filePath) {
  return GET(
    new NextRequest(
      `http://localhost:3001/api/admin/${path.join("/")}?expires=123&signature=private-signature`,
      { headers: { cookie: "ll_admin_access=private-session" } },
    ),
    { params: Promise.resolve({ path }) },
  );
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("admin private media proxy", () => {
  it("waits beyond the storage deadline and preserves authenticated binary delivery", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("image-bytes", { headers: { "Content-Type": "image/jpeg" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const response = await get();
    expect(timeout).toHaveBeenCalledWith(75000);
    expect(fetcher.mock.calls[0]![1].headers.Authorization).toBe("Bearer private-session");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    expect(await response.text()).toBe("image-bytes");
  });
  it("preserves the actual storage error rather than reporting a backend outage", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            {
              error: {
                code: "MEDIA_CONFIGURATION_ERROR",
                message: "File uploads are temporarily unavailable.",
                requestId: "backend-reference",
              },
            },
            { status: 503 },
          ),
        ),
    );
    const response = await get();
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("MEDIA_CONFIGURATION_ERROR");
  });
  it("distinguishes file timeouts and never logs the signed URL or session", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("private-provider-details", "TimeoutError")),
    );
    const response = await get();
    expect(response.status).toBe(504);
    expect((await response.json()).error.code).toBe("ADMIN_MEDIA_TIMEOUT");
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /private-signature|private-session|private-provider-details/,
    );
  });
  it("keeps permission errors and distinguishes malformed upstream responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "FORBIDDEN", message: "Permission required" } },
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(new Response("<html>private error</html>", { status: 502 }));
    vi.stubGlobal("fetch", fetcher);
    const forbidden = await get();
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe("FORBIDDEN");
    const invalid = await get();
    expect(invalid.status).toBe(502);
    expect((await invalid.json()).error.code).toBe("ADMIN_INVALID_RESPONSE");
  });
});
