import type { RequestHandler } from "express";
import { AppError, AuthenticationError } from "../errors/app-error.js";

export const requireRecentAuthentication: RequestHandler = (request, _response, next) => {
  if (!request.auth) return next(new AuthenticationError());
  const authenticatedAt = request.auth.authenticatedAt;
  const age = Date.now() / 1000 - (authenticatedAt ?? 0);
  if (!authenticatedAt || age > 600 || age < -30)
    return next(new AppError({ statusCode: 403, code: "REAUTHENTICATION_REQUIRED", message: "Sign in again before continuing." }));
  next();
};

export const requireMfa: RequestHandler = (request, _response, next) => {
  if (!request.auth) return next(new AuthenticationError());
  if (request.auth.assuranceLevel !== "aal2")
    return next(new AppError({ statusCode: 403, code: "MFA_REQUIRED", message: "Multi-factor authentication is required." }));
  next();
};
