import {
  buyerTransactionsRouter,
  disputeEvidenceAdminRouter,
} from "./routes/buyer-transactions.js";
import {
  paymentsRouter,
  financialRouter,
  moneyAdminRouter,
  bachsWebhookRouter,
} from "./routes/payments.js";
import { identityRouter, dojahWebhookRouter } from "./routes/identity.js";
import { marketplaceRouter } from "./routes/marketplace.js";
import { producePhotosRouter, staffProducePhotosRouter } from "./routes/produce-photos.js";
import {
  customerDeliveryRouter,
  staffDeliveryRouter,
  deliveryWebhookRouter,
} from "./routes/delivery.js";
import { languageRouter } from "./routes/language.js";
import { listingDraftRouter } from "./routes/listing-drafts.js";
import { adminDocumentsRouter, documentUploadsRouter } from "./routes/admin-documents.js";
import { contentRouter } from "./routes/content.js";
import { operationsRouter } from "./routes/admin-operations.js";
import cors from "cors";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import { logger } from "./lib/logger.js";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { verificationRouter } from "./routes/verification.js";
import { adminAuthRouter } from "./routes/admin-auth.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler, notFound } from "./lib/errors.js";
import { requestContext } from "./lib/request-context.js";
import { openapi } from "./openapi.js";
import { prisma } from "@leetlogic/database";
import { redis } from "./lib/redis.js";

export function createApp(requestLogger: Logger = logger): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: false }));
  app.use("/v1/webhooks/dojah", express.raw({ type: "application/json", limit: "1mb" }));
  app.use("/v1/webhooks/bachs", express.raw({ type: "application/json", limit: "256kb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger: requestLogger,
      wrapSerializers: false,
      genReqId: (req: Request) => req.requestId,
      serializers: {
        // Error details have already been sanitized by the error handler.
        err: (error) => error,
        req: (req) => ({
          requestId: req.id,
          method: req.method,
          path: String(req.url).split("?")[0],
        }),
        res: (res) => ({ status: res.statusCode }),
      },
      customLogLevel: (_req, res, error) =>
        error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      customErrorMessage: (req, res) =>
        `${req.method} ${String(req.url).split("?")[0]} → ${res.statusCode}`,
      customErrorObject: (_req, res, _error, value) => ({
        ...value,
        err: (res as express.Response).locals?.requestError || {
          type: "Error",
          code: "REQUEST_FAILED",
          message: "The request could not be completed.",
        },
      }),
      customSuccessObject: (_req, res, value) => ({
        ...value,
        ...((res as express.Response).locals?.requestError
          ? { err: (res as express.Response).locals.requestError }
          : {}),
      }),
      customSuccessMessage: (req, res) =>
        `${req.method} ${String(req.url).split("?")[0]} → ${res.statusCode}`,
    }),
  );
  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (_req, res) => {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis().ping()]);
    res.json({ status: "ready" });
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/v1/seller/verification/uploads", documentUploadsRouter);
  app.use("/v1/admin/verifications/documents", adminDocumentsRouter);
  app.use("/v1/admin/produce-photos", staffProducePhotosRouter);
  app.use("/v1/listing-photos", producePhotosRouter);
  app.use("/v1/orders", buyerTransactionsRouter);
  app.use("/v1/admin/dispute-evidence", disputeEvidenceAdminRouter);
  app.use("/v1/orders", paymentsRouter);
  app.use("/v1/financial", financialRouter);
  app.use("/v1/admin/money", moneyAdminRouter);
  app.use("/v1/webhooks/bachs", bachsWebhookRouter);
  app.use("/v1/orders", customerDeliveryRouter);
  app.use("/v1/admin/delivery-orders", staffDeliveryRouter);
  app.use("/v1/webhooks", deliveryWebhookRouter);
  app.use("/v1/translations", languageRouter);
  app.use("/v1/listing-drafts", listingDraftRouter);
  app.use("/v1/content", contentRouter);
  app.use("/v1/marketplace", marketplaceRouter);
  app.use("/v1/auth", authRouter);
  app.use("/v1/me", meRouter);
  app.use("/v1/webhooks/dojah", dojahWebhookRouter);
  app.use("/v1/seller/verification/identity", identityRouter);
  app.use("/v1/seller/verification", verificationRouter);
  app.use("/v1/admin/auth", adminAuthRouter);
  app.use("/v1/admin", adminRouter);
  app.use("/v1/admin", operationsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
