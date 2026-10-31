import { beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ config: { NODE_ENV: "development", OTP_PROVIDER: "console" }, log: vi.fn() }));
vi.mock("../config.js", () => ({ getConfig: () => h.config }));
vi.mock("../lib/logger.js", () => ({ logger: { info: h.log } }));
import { ConsoleOtpProvider, otpProviders } from "./otp.js";

beforeEach(() => { h.config.NODE_ENV = "development"; vi.clearAllMocks(); });
it("keeps console codes available only for development", async () => {
  await new ConsoleOtpProvider().send("+2348012345678", "123456");
  expect(h.log).toHaveBeenCalledOnce();
});
it("fails closed without logging the phone or OTP when console delivery is configured in production", async () => {
  h.config.NODE_ENV = "production";
  await expect(otpProviders()[0]!.send("+2348012345678", "123456")).rejects.toThrow("development-only");
  expect(h.log).not.toHaveBeenCalled();
});
