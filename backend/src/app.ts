import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.js";
import { requestContextMiddleware } from "./shared/middleware/request-context.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/request-id.middleware.js";
import { requestLoggerMiddleware } from "./shared/middleware/request-logger.middleware.js";
import { createV1Router, type V1RouterOptions } from "./routes/v1.routes.js";
import { AppError, PayloadTooLargeError, ValidationError } from "./shared/errors/app-error.js";
import { endpointLimiter, rejectUnexpectedForwarding, trustedOrigins } from "./shared/middleware/security-policy.js";
import { runtimeControlMiddleware } from "./infrastructure/security/runtime-controls.js";
import { securityAuditMiddleware, type SecurityAuditSink } from "./shared/middleware/security-audit.middleware.js";

export interface CreateAppOptions {
  allowedOrigin?: string;
  bodyLimit?: string;
  v1?: V1RouterOptions;
  trustedProxyAddresses?: string[];
  securityAuditSink?: SecurityAuditSink;
}

interface BodyParserError {
  type: string;
}

function isBodyParserError(error: unknown): error is SyntaxError & BodyParserError {
  return typeof error === "object" && error !== null && "type" in error;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const allowedOrigins = trustedOrigins(options.allowedOrigin);
  app.set("trust proxy", options.trustedProxyAddresses?.length ? options.trustedProxyAddresses : false);
  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(requestContextMiddleware);
  app.use(requestLoggerMiddleware);
  if (options.securityAuditSink) app.use(securityAuditMiddleware(options.securityAuditSink));
  app.use(helmet());
  app.use((request, _response, next) => {
    const origin = request.header("origin");
    const method = request.header("access-control-request-method") ?? request.method;
    if ((origin && !allowedOrigins.includes(origin)) || !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(method))
      return next(new AppError({ statusCode: 403, code: "ORIGIN_OR_METHOD_FORBIDDEN", message: "The request is not allowed." }));
    next();
  });
  app.use(cors({ origin: allowedOrigins, credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id", "X-Echo-Csrf", "Idempotency-Key", "X-ECHO-ANALYSIS-FIXTURE"] }));
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    next();
  });
  // Request correlation must precede body parsing so that body-parser failures
  // are attributable to a requestId.
  app.use(rejectUnexpectedForwarding);
  app.use(endpointLimiter(120));
  app.use(express.json({ limit: options.bodyLimit ?? "1mb" }));
  // Map body-parser failures to proper client errors instead of a generic 500:
  // malformed JSON -> 400, oversized payload -> 413.
  app.use((error: unknown, _request: express.Request, _response: express.Response, next: express.NextFunction) => {
    if (isBodyParserError(error)) {
      if (error.type === "entity.too.large") {
        return next(new PayloadTooLargeError());
      }
      return next(new ValidationError({ field: "body", reason: "The request body is malformed." }));
    }
    return next(error);
  });
  app.use(runtimeControlMiddleware);
  app.use("/api/v1", createV1Router(options.v1));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
