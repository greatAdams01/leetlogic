import { describe, expect, it } from "vitest";
import { formatLogLine } from "./logger.js";

describe("development log formatting", () => {
  it("keeps messages and multiline error details on one physical line", () => {
    const output = formatLogLine({ time: 0, level: 50, msg: "Request\nfailed", req: { requestId: "test-id", method: "POST" }, err: { stack: "Error\n at handler" }, pid: 123, hostname: "local" });
    expect(output).toContain("1970-01-01T00:00:00.000Z ERROR Request failed");
    expect(output).toContain('"requestId":"test-id"');
    expect(output.trim().split("\n")).toHaveLength(1);
    expect(output).not.toContain("hostname=");
  });
});
