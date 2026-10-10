import { Prisma } from "@leetlogic/database";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
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
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "body";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return res
      .status(422)
      .json({
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
  const appError =
    error instanceof AppError
      ? error
      : (databaseError ?? new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred"));
  if (appError.retryAfterSeconds) res.setHeader("Retry-After", appError.retryAfterSeconds);
  return res
    .status(appError.status)
    .json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { fieldErrors: appError.details } : {}),
        requestId: req.requestId,
        ...(appError.retryAfterSeconds ? { retryAfterSeconds: appError.retryAfterSeconds } : {}),
      },
    });
}
