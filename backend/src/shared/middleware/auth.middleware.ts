import {appPresence} from '../../infrastructure/security/app-presence.js';
import type { NextFunction, Request, Response } from "express";
import { resettingAccounts } from "../account-activity-reset.js";
import { AuthenticationError, ConflictError } from "../errors/app-error.js";
import type { AuthenticatedUser } from "../types/authenticated-user.js";
import { setVerifiedAccessToken } from "../request-context.js";

export interface AccessTokenVerifier {
  getUser(accessToken: string): Promise<AuthenticatedUser | null>;
}

const verifiedRequests = new WeakMap<Request, { token: string; verifier: AccessTokenVerifier; user: AuthenticatedUser }>();

export function createAuthMiddleware(verifier: AccessTokenVerifier) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
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
      const previous = verifiedRequests.get(request);
      const reused = previous?.token === accessToken && previous.verifier === verifier;
      const startedAt = performance.now();
      try {
        user = reused
          ? previous.user
          : await verifier.getUser(accessToken);
      } catch {
        console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "signature_failure" }));
        user = null;
      } finally {
        if (!reused)
          response.locals.authVerificationMs = (response.locals.authVerificationMs ?? 0) + Math.round(performance.now() - startedAt);
      }
      if (!user) {
        console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "user_verification_failure" }));
        throw new AuthenticationError("INVALID_ACCESS_TOKEN", "Your session is invalid or expired.");
      }

      console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "accepted" }));
      if(user.sessionId && appPresence()?.isClosed(user.id,user.sessionId))throw new AuthenticationError('APP_SESSION_CLOSED','Your app session ended. Please log in again.');
      if (resettingAccounts.has(user.id) && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !request.path.endsWith("/settings/activity-reset"))
        throw new ConflictError("RESET_BUSY", "Your activity reset is running. Please wait before making changes.");
      request.auth = { ...user, accessToken };
      verifiedRequests.set(request, { token: accessToken, verifier, user });
      setVerifiedAccessToken(accessToken);
      next();
    } catch (error) {
      next(error);
    }
  };
}
