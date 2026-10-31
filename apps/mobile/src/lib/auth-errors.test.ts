import { expect, it } from "vitest";
import { needsSignIn, profileFailureCode } from "./auth-errors";

it.each(["AUTH_REQUIRED", "SESSION_EXPIRED", "INVALID_ACCESS_TOKEN", "ACCOUNT_UNAVAILABLE", "USER_NOT_FOUND"])("recognizes an invalid account/session: %s", (code) => {
  expect(needsSignIn({ code })).toBe(true);
});
it.each(["DATABASE_SCHEMA_MISMATCH", "DATABASE_UNAVAILABLE", "NETWORK_ERROR", "DEPENDENCY_UNAVAILABLE", "INVALID_SERVER_RESPONSE"])("does not turn a temporary profile failure into a logout: %s", (code) => {
  expect(needsSignIn({ code, status: 503 })).toBe(false);
});
it("uses HTTP authorization status even when the error code is absent", () => {
  expect(needsSignIn({ status: 401 })).toBe(true);
  expect(needsSignIn({ status: 403 })).toBe(true);
  expect(needsSignIn(null)).toBe(false);
});
it("preserves role-review guidance while hiding unknown profile failure details", () => {
  expect(profileFailureCode({ code: "ACCOUNT_ROLE_CONFLICT" })).toBe("ACCOUNT_ROLE_CONFLICT");
  expect(profileFailureCode({ code: "DATABASE_SCHEMA_MISMATCH", message: "private details" })).toBe("PROFILE_UNAVAILABLE");
  expect(profileFailureCode(null)).toBe("PROFILE_UNAVAILABLE");
});
