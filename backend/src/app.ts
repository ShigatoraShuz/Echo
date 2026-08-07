import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { errorMiddleware } from "./shared/middleware/error.middleware.js";
import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/request-id.middleware.js";
import { requestLoggerMiddleware } from "./shared/middleware/request-logger.middleware.js";
import { createV1Router, type V1RouterOptions } from "./routes/v1.routes.js";

export interface CreateAppOptions {
  allowedOrigin?: string;
  bodyLimit?: string;
  v1?: V1RouterOptions;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const allowedOrigin = options.allowedOrigin;
  const allowedOrigins = allowedOrigin
    ? Array.from(
        new Set([
          allowedOrigin,
          allowedOrigin.replace("localhost", "127.0.0.1"),
          allowedOrigin.replace("127.0.0.1", "localhost"),
        ]),
      )
    : false;
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    next();
  });
  app.use(express.json({ limit: options.bodyLimit ?? "1mb" }));
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use("/api/v1", createV1Router(options.v1));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
