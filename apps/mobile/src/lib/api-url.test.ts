import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "./api-url";
const dev = { development: true, platform: "ios" };
describe("API address selection", () => {
  it("uses Metro's LAN host for physical Expo Go on either platform", () => {
    for (const platform of ["ios", "android"])
      expect(resolveApiUrl({ ...dev, platform, hostUri: "10.173.28.54:8082" })).toBe(
        "http://10.173.28.54:3000",
      );
    expect(resolveApiUrl({ ...dev, hostUri: "192.168.1.2:8081" })).toBe("http://192.168.1.2:3000");
    expect(resolveApiUrl({ ...dev, hostUri: "172.16.1.2:8081" })).toBe("http://172.16.1.2:3000");
  });
  it("keeps an explicit backend override", () => {
    expect(
      resolveApiUrl({
        ...dev,
        hostUri: "test.exp.direct:80",
        explicitUrl: " https://api.example.com/ ",
      }),
    ).toBe("https://api.example.com");
  });
  it("supports simulator loopback and IPv6 LAN addresses", () => {
    expect(resolveApiUrl({ ...dev, hostUri: "localhost:8082" })).toBe("http://localhost:3000");
    expect(resolveApiUrl({ ...dev, platform: "android", hostUri: "127.0.0.1:8082" })).toBe(
      "http://10.0.2.2:3000",
    );
    expect(resolveApiUrl({ ...dev, hostUri: "[fd12::123]:8082" })).toBe("http://[fd12::123]:3000");
    expect(resolveApiUrl({ ...dev })).toBe("http://localhost:3000");
  });
  it("does not mistake a public Metro tunnel for a backend", () => {
    expect(() => resolveApiUrl({ ...dev, hostUri: "test.exp.direct:80" })).toThrow(
      "Expo tunnel detected",
    );
    expect(() => resolveApiUrl({ ...dev, hostUri: "172.32.1.2:8082" })).toThrow(
      "Expo tunnel detected",
    );
  });
  it("requires an explicitly configured HTTPS backend in releases", () => {
    expect(() => resolveApiUrl({ ...dev, development: false })).toThrow("Set EXPO_PUBLIC_API_URL");
    expect(() =>
      resolveApiUrl({ ...dev, development: false, explicitUrl: "http://api.example.com" }),
    ).toThrow("HTTPS");
    expect(
      resolveApiUrl({ ...dev, development: false, explicitUrl: "https://api.example.com" }),
    ).toBe("https://api.example.com");
    expect(() => resolveApiUrl({ ...dev, explicitUrl: "file:///tmp/api" })).toThrow(
      "HTTP or HTTPS",
    );
  });
});
