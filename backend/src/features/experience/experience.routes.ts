import { Router } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerifiedAiAccessMiddleware } from "../verification/verification.middleware.js";
import type { VerificationService } from "../verification/verification.service.js";
import { createExperienceController } from "./experience.controller.js";
import type { ExperienceService } from "./experience.service.js";

export function createExperienceRouter(
  service: ExperienceService,
  verifier: AccessTokenVerifier,
  verificationService: VerificationService,
): Router {
  const controller = createExperienceController(service);
  const router = Router();

  // Verified support resources are intentionally public. All personal routes
  // below this line require a valid Supabase access token.
  router.get("/support-resources", controller.supportResources);
  const authenticate = createAuthMiddleware(verifier);
  const requireVerifiedAi = createVerifiedAiAccessMiddleware(verificationService);
  router.get("/dashboard", authenticate, controller.dashboard);
  router.get("/buddy/session", authenticate, requireVerifiedAi, controller.buddySession);
  router.post("/buddy/messages", authenticate, requireVerifiedAi, controller.sendBuddyMessage);
  router.get("/buddy/history", authenticate, requireVerifiedAi, controller.buddyHistory);
  router.get("/insights/emotions", authenticate, controller.emotionInsights);
  router.post("/grounding/sessions", authenticate, controller.completeGrounding);
  return router;
}
