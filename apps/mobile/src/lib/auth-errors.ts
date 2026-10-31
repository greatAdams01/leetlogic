/** A profile outage must not be confused with an invalid or unavailable account. */
export function needsSignIn(value: unknown): boolean {
  const error = value as { status?: number; code?: string } | null;
  return error?.status === 401 || error?.status === 403 || [
    "AUTH_REQUIRED", "SIGN_IN_REQUIRED", "SESSION_EXPIRED", "INVALID_ACCESS_TOKEN",
    "INVALID_REFRESH_TOKEN", "REFRESH_TOKEN_REUSED", "ACCOUNT_UNAVAILABLE", "USER_NOT_FOUND",
  ].includes(error?.code || "");
}

export function profileFailureCode(value: unknown): "PROFILE_UNAVAILABLE" | "ACCOUNT_ROLE_CONFLICT" {
  return (value as { code?: string } | null)?.code === "ACCOUNT_ROLE_CONFLICT"
    ? "ACCOUNT_ROLE_CONFLICT"
    : "PROFILE_UNAVAILABLE";
}
