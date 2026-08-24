import type { NextFunction, Request, Response } from "express";
import { AuthenticationError } from "../errors/app-error.js";
import type { AuthenticatedUser } from "../types/authenticated-user.js";

type JwtPayload = {
  exp?: number;
  iss?: string;
  [key: string]: unknown;
};

export interface AccessTokenVerifier {
  getUser(accessToken: string): Promise<AuthenticatedUser | null>;
}

function decodeJwtPayload(accessToken: string): JwtPayload | null {
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(payload) as JwtPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
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

      const jwtPayload = decodeJwtPayload(accessToken);
      if (jwtPayload) {
        const exp = typeof jwtPayload.exp === "number" ? jwtPayload.exp : null;
        if (exp !== null && exp * 1000 <= Date.now()) {
          console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "expired_token" }));
          throw new AuthenticationError("INVALID_ACCESS_TOKEN", "Your session is invalid or expired.");
        }

        const issuer = typeof jwtPayload.iss === "string" ? jwtPayload.iss : "";
        if (issuer && issuer !== "https://lruciislmmqvcwweqjop.supabase.co/auth/v1") {
          console.info(JSON.stringify({ requestId: request.requestId, authDiagnostic: "issuer_mismatch" }));
          throw new AuthenticationError("INVALID_ACCESS_TOKEN", "Your session is invalid or expired.");
        }
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
      next();
    } catch (error) {
      next(error);
    }
  };
}
