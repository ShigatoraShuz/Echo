import { Router, type NextFunction, type Request, type Response } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { AuthorizationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { AccessService } from "./access.service.js";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";

export function createAccessRouter(service: AccessService, verifier: AccessTokenVerifier): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);
  router.get("/access/status", authenticate, async (request, response, next) => {
    try {
      sendSuccess(response, await service.decide(request.auth!));
    } catch (error) {
      next(error);
    }
  });
  router.post("/access/age", authenticate, async (request, response, next) => {
    try {
      const parsed = z.object({ birthday: z.string() }).safeParse(request.body);
      if (!parsed.success) throw new ValidationError();
      await service.verifyLegacyAge(request.auth!.id, parsed.data.birthday);
      sendSuccess(response, { verified: true });
    } catch (error) {
      next(error);
    }
  });
  router.post("/access/policies", authenticate, async (request, response, next) => {
    try {
      const parsed = z
        .object({ reviewedDocumentIds: z.array(z.string().uuid()).length(3) })
        .strict()
        .safeParse(request.body);
      if (!parsed.success) throw new ValidationError();
      await service.acceptCurrentPolicies(request.auth!.id, parsed.data.reviewedDocumentIds);
      sendSuccess(response, { accepted: true });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createAccessGuard(service: AccessService) {
  // Private journals and existing analysis status have their own scoped gates.
  // Declining AI must not remove access to ordinary journaling.
  const allowedPrefixes = [
    "/access/",
    "/onboarding/",
    "/verification",
    "/journals",
    "/analysis-jobs",
    "/support-resources",
  ];
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      if (allowedPrefixes.some((prefix) => request.path.startsWith(prefix))) return next();
      const result = await service.decide(request.auth!);
      if (result.decision !== "ACCESS_GRANTED")
        throw new AuthorizationError(`ECHO access is not ready: ${result.decision}.`);
      next();
    } catch (error) {
      next(error);
    }
  };
}
