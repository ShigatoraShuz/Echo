import type { NextFunction, Request, Response } from "express";
import { AuthenticationError } from "../errors/app-error.js";
import type { AuthenticatedUser } from "../types/authenticated-user.js";
import { setVerifiedAccessToken } from "../request-context.js";

export interface AccessTokenVerifier {
  getUser(accessToken: string): Promise<AuthenticatedUser | null>;
}

export function createAuthMiddleware(verifier: AccessTokenVerifier) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const authorization = request.header("authorization");
      if (!authorization?.startsWith("Bearer ")) {
        console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "missing_header" }));
        throw new AuthenticationError();
      }

      const accessToken = authorization.slice("Bearer ".length).trim();
      if (!accessToken) {
        console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "malformed_header" }));
        throw new AuthenticationError();
      }

      let user: AuthenticatedUser | null;
      try {
        user = await verifier.getUser(accessToken);
      } catch {
        console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "signature_failure" }));
        user = null;
      }
      if (!user) {
        console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "user_verification_failure" }));
        throw new AuthenticationError("INVALID_ACCESS_TOKEN", "Your session is invalid or expired.");
      }

      console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "accepted" }));
      request.auth = { ...user, accessToken };
      setVerifiedAccessToken(accessToken);
      next();
    } catch (error) {
      next(error);
    }
  };
}
