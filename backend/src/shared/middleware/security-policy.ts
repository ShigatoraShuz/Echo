import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

export function trustedOrigins(configured?: string): string[] {
  if (!configured) return [];
  const origin = new URL(configured);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/")
    throw new Error("FRONTEND_URL must be an exact origin.");
  const result = [origin.origin];
  if (process.env.NODE_ENV !== "production" && origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)) {
    origin.hostname = origin.hostname === "localhost" ? "127.0.0.1" : "localhost";
    result.push(origin.origin);
  }
  return result;
}

export function endpointLimiter(limit: number, windowMs = 60_000) {
  return rateLimit({
    windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: (request) => request.auth?.id ?? ipKeyGenerator(request.ip ?? request.socket.remoteAddress ?? "unknown"),
    handler: (_request, _response, next) => next(new AppError({ statusCode: 429, code: "RATE_LIMITED", message: "Too many requests. Please try again later." })),
  });
}

export const rejectUnexpectedForwarding: RequestHandler = (request, _response, next) => {
  if (request.app.get("trust proxy") === false && (request.header("x-forwarded-for") || request.header("forwarded")))
    return next(new AppError({ statusCode: 400, code: "UNTRUSTED_PROXY", message: "The request is invalid." }));
  next();
};
