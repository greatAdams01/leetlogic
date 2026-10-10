import { expect, it } from "vitest";
import { hashPassword, checkPassword } from "./admin-password.js";
it("salts passwords and rejects incorrect or malformed credentials", async () => {
  const a = await hashPassword("a-long-test-password");
  const b = await hashPassword("a-long-test-password");
  expect(a).not.toBe(b);
  expect(await checkPassword("a-long-test-password", a)).toBe(true);
  expect(await checkPassword("different-password", a)).toBe(false);
  expect(await checkPassword("a-long-test-password", "invalid")).toBe(false);
});
