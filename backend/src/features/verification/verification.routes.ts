import express, { Router } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerificationController } from "./verification.controller.js";
import type { VerificationService } from "./verification.service.js";

export function createVerificationRouter(
  service: VerificationService,
  verifier: AccessTokenVerifier,
): Router {
  const router = Router();
  const controller = createVerificationController(service);
  const authenticate = createAuthMiddleware(verifier);

  router.get("/verification", authenticate, controller.status);
  router.put("/verification/application", authenticate, controller.saveApplication);
  router.put(
    "/verification/documents/:kind",
    authenticate,
    express.raw({
      type: ["image/jpeg", "image/png", "application/pdf"],
      limit: "8mb",
    }),
    controller.uploadDocument,
  );
  router.post("/verification/submit", authenticate, controller.submit);

  router.get("/admin/verifications", authenticate, controller.adminList);
  router.get("/admin/verifications/:verificationId", authenticate, controller.adminDetail);
  router.post("/admin/verifications/:verificationId/claim", authenticate, controller.adminClaim);
  router.post("/admin/verifications/:verificationId/decision", authenticate, controller.adminDecision);
  return router;
}
