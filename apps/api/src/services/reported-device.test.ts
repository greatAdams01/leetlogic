import { expect, it } from "vitest";
import type { Request } from "express";
import { reportedDevice } from "./reported-device.js";
const request = (name?: string, platform?: string) =>
  ({ get: (key: string) => (key === "X-LeetLogic-Device-Name" ? name : platform) }) as Request;
it("accepts bounded Unicode display metadata and a real supported platform", () => {
  expect(reportedDevice(request(encodeURIComponent("Farmer’s phone"), "android"))).toEqual({
    deviceName: "Farmer’s phone",
    devicePlatform: "android",
  });
});
it("does not invent a name for legacy devices or accept malformed metadata", () => {
  expect(reportedDevice(request())).toEqual({});
  expect(reportedDevice(request("%invalid", "ios"))).toEqual({ devicePlatform: "ios" });
  expect(reportedDevice(request("x".repeat(101), "android"))).toEqual({
    devicePlatform: "android",
  });
  expect(reportedDevice(request("Phone", "unknown"))).toEqual({});
});
