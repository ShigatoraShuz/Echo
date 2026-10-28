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
    const startedAt = performance.now();
    try {
      const decision = await service.decide(request.auth!);
      response.locals.accessDecisionMs = Math.round(performance.now() - startedAt);
      response.setHeader("Server-Timing", `access;dur=${response.locals.accessDecisionMs}`);
      sendSuccess(response, decision);
    } catch (error) {
      response.locals.accessDecisionMs = Math.round(performance.now() - startedAt);
      next(error);
    }
  });
  router.post("/access/age", authenticate, async (request, response, next) => {
    try {
      if (await service.hasPendingDeletion(request.auth!.id)) throw new AuthorizationError("Account deletion is pending.");
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
      if (await service.hasPendingDeletion(request.auth!.id)) throw new AuthorizationError("Account deletion is pending.");
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
  return async (request: Request, response: Response, next: NextFunction) => {
    const startedAt = performance.now();
    try {
      const scopedRoute = allowedPrefixes.some((prefix) => request.path.startsWith(prefix));
      const decision = scopedRoute ? null : await service.decide(request.auth!);
      const pendingDeletion = scopedRoute
        ? await service.hasPendingDeletion(request.auth!.id)
        : decision?.decision === "DELETION_PENDING";
      response.locals.accessDecisionMs = Math.round(performance.now() - startedAt);
      if (pendingDeletion) {
        const path = request.path;
        const permitted =
          (request.method === "GET" && path === "/settings/account-deletion") ||
          (request.method === "PATCH" && /^\/settings\/account-deletion\/[0-9a-f-]+\/cancel$/i.test(path)) ||
          (request.method === "POST" && path === "/settings/data-exports") ||
          (request.method === "GET" && /^\/settings\/data-exports\/[0-9a-f-]+\/download$/i.test(path));
        if (!permitted) throw new AuthorizationError("Only account deletion, cancellation and export are available while deletion is pending.");
        return next();
      }
      if (scopedRoute) return next();
      if (decision?.decision !== "ACCESS_GRANTED")
        throw new AuthorizationError(`ECHO access is not ready: ${decision?.decision}.`);
      next();
    } catch (error) {
      response.locals.accessDecisionMs = Math.round(performance.now() - startedAt);
      next(error);
    }
  };
}
