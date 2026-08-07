import { Router } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerifiedAiAccessMiddleware } from "../verification/verification.middleware.js";
import type { VerificationService } from "../verification/verification.service.js";
import type { JournalService } from "./journals.service.js";
import { createJournalsController } from "./journals.controller.js";

export function createJournalsRouter(
  service: JournalService,
  verifier: AccessTokenVerifier,
  verificationService: VerificationService,
): Router {
  const controller = createJournalsController(service);
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);
  const requireVerifiedAi = createVerifiedAiAccessMiddleware(verificationService);
  router.get("/journals", authenticate, controller.list);
  router.post("/journals", authenticate, controller.create);
  router.get("/journals/draft", authenticate, controller.getDraft);
  router.put("/journals/draft", authenticate, controller.saveDraft);
  router.delete("/journals/draft", authenticate, controller.deleteDraft);
  router.get("/journals/:journalId", authenticate, controller.get);
  router.patch("/journals/:journalId", authenticate, controller.update);
  router.delete("/journals/:journalId", authenticate, controller.remove);
  router.post("/journals/:journalId/analyze", authenticate, requireVerifiedAi, controller.analyze);
  router.get("/journals/:journalId/analyses", authenticate, requireVerifiedAi, controller.analyses);
  return router;
}
