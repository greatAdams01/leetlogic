import { Writable } from "node:stream";
import pino from "pino";

const levels: Record<number, string> = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};
const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replaceAll(String.fromCharCode(27), " ");
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** Compact request summaries with indented diagnostics instead of escaped JSON blobs. */
export function formatLogLine(record: Record<string, unknown>): string {
  const {
    time,
    level,
    msg,
    req,
    res,
    err,
    responseTime,
    pid: _pid,
    hostname: _hostname,
    ...fields
  } = record;
  void _pid;
  void _hostname;
  const request = object(req),
    response = object(res),
    error = object(err);
  const timestamp = typeof time === "number" ? new Date(time).toISOString() : clean(time);
  const summary = request.method
    ? `${clean(request.method)} ${clean(request.path)}  ${clean(response.status)}${typeof responseTime === "number" ? `  ${Math.round(responseTime)}ms` : ""}`
    : clean(msg);
  let output = `${timestamp} ${String(levels[Number(level)] ?? level).padEnd(5)} ${summary}${request.requestId ? `  request=${clean(request.requestId)}` : ""}\n`;
  if (error.message)
    output += `  Cause: ${error.code ? `${clean(error.code)} — ` : ""}${clean(error.message)}\n`;
  if (error.type) output += `  Type: ${clean(error.type)}\n`;
  if (error.hint) output += `  Fix: ${clean(error.hint)}\n`;
  // Stack frames remain available in debug mode, on separate readable lines.
  if (error.stack && process.env.LOG_LEVEL === "debug") {
    for (const frame of String(error.stack)
      .split("\n")
      .filter((line) => line.trim().startsWith("at ")))
      output += `    ${clean(frame.trim())}\n`;
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined)
      output += `  ${clean(key)}: ${typeof value === "object" ? clean(JSON.stringify(value)) : clean(value)}\n`;
  }
  return output;
}

const readableOutput = new Writable({
  write(chunk, _encoding, callback) {
    try {
      for (const line of chunk.toString().trim().split("\n")) {
        if (line) process.stdout.write(formatLogLine(JSON.parse(line)));
      }
      callback();
    } catch (error) {
      callback(error as Error);
    }
  },
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "authorization",
      "refreshToken",
      "preAuthToken",
      "password",
      "secret",
      "req.headers.authorization",
    ],
  },
  process.env.NODE_ENV === "production" || process.env.LOG_FORMAT === "json"
    ? pino.destination(1)
    : readableOutput,
);
