import { dependencyError } from "./dependency-errors.js";
import { Prisma } from "@leetlogic/database";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  // Server-only diagnostics. Never included in the customer response.
  diagnostics?: {
    provider: string;
    operation: string;
    providerStatus?: number;
    reason: string;
    hint: string;
  };
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "NOT_FOUND", `No route for ${req.method} ${req.path}`));
}
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  void _next;
  res.locals ??= {};
  if (error instanceof ZodError) {
    res.locals.requestError = {
      type: "ValidationError",
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
    };
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "body";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fieldErrors,
        requestId: req.requestId,
      },
    });
  }
  const databaseError =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code === "P2002"
        ? new AppError(409, "DUPLICATE_RECORD", "A record with these details already exists")
        : error.code === "P2025"
          ? new AppError(404, "RECORD_NOT_FOUND", "Record was not found")
          : error.code === "P2003"
            ? new AppError(422, "INVALID_REFERENCE", "Referenced record does not exist")
            : error.code === "P2034"
              ? new AppError(409, "CONCURRENT_CHANGE", "Record changed. Please retry.")
              : undefined
      : undefined;
  const dependency = dependencyError(error);
  const appError =
    error instanceof AppError
      ? error
      : dependency
        ? new AppError(503, dependency.code, "Service is temporarily unavailable. Please try again.")
        : (databaseError ?? new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred"));
  const original = error instanceof Error ? error : undefined;
  res.locals.requestError = {
    type: original?.name || "Error",
    code: dependency?.code || appError.code,
    message: dependency?.message || appError.message,
    ...(dependency ? { hint: dependency.hint } : {}),
    ...(dependency?.database ? { database: dependency.database } : {}),
    ...(appError.diagnostics ? appError.diagnostics : {}),
    // Keep source frames without Prisma query text, credentials, or submitted values.
    ...(appError.status >= 500 && original?.stack
      ? {
          stack: original.stack
            .split("\n")
            .filter((line) => line.trim().startsWith("at "))
            .join("\n"),
        }
      : {}),
  };
  if (dependency) res.setHeader("Retry-After", "5");
  if (appError.retryAfterSeconds) res.setHeader("Retry-After", appError.retryAfterSeconds);
  return res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { fieldErrors: appError.details } : {}),
      requestId: req.requestId,
      ...(appError.retryAfterSeconds ? { retryAfterSeconds: appError.retryAfterSeconds } : {}),
    },
  });
}
