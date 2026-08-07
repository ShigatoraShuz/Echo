import type { NextFunction, Request, Response } from "express";
import { AuthenticationError } from "../errors/app-error.js";
import type { AuthenticatedUser } from "../types/authenticated-user.js";

export interface AccessTokenVerifier {
  getUser(accessToken: string): Promise<AuthenticatedUser | null>;
}

export function createAuthMiddleware(verifier: AccessTokenVerifier) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const authorization = request.header("authorization");
      if (!authorization?.startsWith("Bearer ")) {
        throw new AuthenticationError();
      }

      const accessToken = authorization.slice("Bearer ".length).trim();
      if (!accessToken) throw new AuthenticationError();

      let user: AuthenticatedUser | null;
      try {
        user = await verifier.getUser(accessToken);
      } catch {
        // Fail closed: an unverifiable token (expired, wrong audience, format
        // error, verifier outage) is treated as no valid session, never as a
        // server fault that leaks token details.
        user = null;
      }
      if (!user) throw new AuthenticationError("INVALID_ACCESS_TOKEN", "Your session is invalid or expired.");

      request.auth = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
