import { Writable } from "node:stream";
import pino from "pino";

const levels: Record<number, string> = { 10: "TRACE", 20: "DEBUG", 30: "INFO", 40: "WARN", 50: "ERROR", 60: "FATAL" };

export function formatLogLine(record: Record<string, unknown>): string {
  const { time, level, msg, pid: _pid, hostname: _hostname, ...fields } = record;
  const timestamp = typeof time === "number" ? new Date(time).toISOString() : String(time);
  void _pid; void _hostname;
  const details = Object.entries(fields).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
  return `${timestamp} ${levels[Number(level)] ?? level} ${String(msg ?? "").replace(/[\r\n]/g, " ")}${details ? ` | ${details}` : ""}\n`;
}

const readableOutput = new Writable({
  write(chunk, _encoding, callback) {
    try {
      for (const line of chunk.toString().trim().split("\n")) {
        if (line) process.stdout.write(formatLogLine(JSON.parse(line)));
      }
      callback();
    } catch (error) { callback(error as Error); }
  },
});

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["authorization", "refreshToken", "preAuthToken", "password", "secret", "req.headers.authorization"],
}, process.env.NODE_ENV === "production" ? pino.destination(1) : readableOutput);
