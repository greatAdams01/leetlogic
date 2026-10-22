/** Only allowlisted diagnostics are logged: database error messages may contain query values. */
export function dependencyError(
  error: unknown,
): { code: string; message: string; hint: string } | undefined {
  if (!error || typeof error !== "object") return;
  const item = error as { code?: string; errorCode?: string; name?: string };
  const code = item.code || item.errorCode;
  if (
    ["P1000", "P1001", "P1002", "P1008", "P1017"].includes(code || "") ||
    item.name === "PrismaClientInitializationError"
  )
    return {
      code: "DATABASE_UNAVAILABLE",
      message: "PostgreSQL is unavailable or its connection configuration is invalid.",
      hint: "Run docker compose up -d postgres redis; check database health and DATABASE_URL.",
    };
  if (["P2021", "P2022"].includes(code || ""))
    return {
      code: "DATABASE_SCHEMA_MISMATCH",
      message: "The database schema is missing a required table or column.",
      hint: "Apply the existing Prisma migrations to the configured database.",
    };
  if (item.name === "MaxRetriesPerRequestError" || code === "NR_CLOSED")
    return {
      code: "REDIS_UNAVAILABLE",
      message: "Redis is unavailable.",
      hint: "Run docker compose up -d postgres redis; check Redis health and REDIS_URL.",
    };
  if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code || ""))
    return {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "A required service could not be reached.",
      hint: "Check dependent services and their connection configuration.",
    };
}
