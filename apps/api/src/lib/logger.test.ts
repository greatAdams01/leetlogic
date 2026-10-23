import { describe, expect, it } from "vitest";
import { formatLogLine } from "./logger.js";

describe("development log formatting", () => {
  it("prints request details in readable columns without JSON duplication", () => {
    const output = formatLogLine({
      time: 0,
      level: 30,
      msg: "GET /v1/content/translations → 200",
      req: { requestId: "test-id", method: "GET", path: "/v1/content/translations" },
      res: { status: 200 },
      responseTime: 12.4,
      pid: 123,
      hostname: "local",
    });
    expect(output).toBe(
      "1970-01-01T00:00:00.000Z INFO  GET /v1/content/translations  200  12ms  request=test-id\n",
    );
    expect(output).not.toContain("req=");
    expect(output).not.toContain("hostname");
  });
  it("uses separate indented lines for actionable errors", () => {
    const output = formatLogLine({
      time: 0,
      level: 50,
      req: { method: "GET", path: "/health/ready", requestId: "test" },
      res: { status: 503 },
      err: {
        type: "PrismaClientInitializationError",
        code: "DATABASE_UNAVAILABLE",
        message: "PostgreSQL unavailable",
        hint: "Start Docker",
        stack: "Error\n at handler",
      },
    });
    expect(output).toContain("Cause: DATABASE_UNAVAILABLE — PostgreSQL unavailable\n");
    expect(output).toContain("  Fix: Start Docker\n");
    expect(output).not.toContain("\\n");
    expect(output).not.toContain("at handler");
  });
  it("shows safe media provider diagnostics without raw provider payloads", () => {
    const output = formatLogLine({
      time: 0,
      level: 50,
      err: {
        code: "MEDIA_CONFIGURATION_ERROR",
        message: "Uploads temporarily unavailable",
        provider: "cloudinary",
        operation: "upload",
        providerStatus: 401,
        reason: "INVALID_API_KEY",
        hint: "Check root .env and restart API",
      },
    });
    expect(output).toContain("Provider: cloudinary · upload · HTTP 401 · INVALID_API_KEY");
    expect(output).toContain("Fix: Check root .env and restart API");
  });
  it("preserves console OTP fields while preventing multiline log injection", () => {
    const output = formatLogLine({
      time: 0,
      level: 30,
      msg: "Development OTP\nfor testing",
      phone: "+2340000000000",
      code: "123456",
    });
    expect(output).toContain("Development OTP for testing");
    expect(output).toContain("  code: 123456\n");
  });
});
