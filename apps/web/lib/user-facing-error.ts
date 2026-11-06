const fallback =
  "Something went wrong. Please try again. If the problem continues, contact support.";
/** Preserve useful business guidance, but never render runtime traces or infrastructure diagnostics. */
export function userFacingError(value: unknown, defaultMessage = fallback): string {
  const error = value as { name?: unknown; message?: unknown } | null;
  const message =
    typeof value === "string" ? value : typeof error?.message === "string" ? error.message : "";
  if (/failed to fetch|network request failed|load failed|ECONN|ENOTFOUND|ETIMEDOUT/i.test(message))
    return "We couldn’t connect. Check your connection and try again.";
  if (
    !message ||
    ["TypeError", "ReferenceError", "SyntaxError", "RangeError"].includes(String(error?.name)) ||
    /\b(?:TypeError|ReferenceError|SyntaxError|RangeError)\b|cannot (?:read|set) propert|is not a function|is not defined|undefined is not|unexpected token|JSON\.parse|Prisma|SQLSTATE|postgres|\bP20\d\d\b|\bSELECT\b.+\bFROM\b|\b(?:column|relation|table)\b.+does not exist|\bat\s+\S+\s*\([^)]*:\d+:\d+\)|(?:\/Users\/|node_modules\/|webpack-internal:|turbopack)/is.test(
      message,
    )
  )
    return defaultMessage;
  return message;
}
