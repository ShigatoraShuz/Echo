import { Router } from "express";
import rateLimit from "express-rate-limit";
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

  // Buddy messages and grounding sessions carry AI inference and database
  // write costs, so they get a stricter budget than the global rate limit.
  const aiWriteLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  // Verified support resources are intentionally public. All personal routes
  // below this line require a valid Supabase access token.
  router.get("/support-resources", controller.supportResources);
  const authenticate = createAuthMiddleware(verifier);
  const requireVerifiedAi = createVerifiedAiAccessMiddleware(verificationService);
  router.get("/dashboard", authenticate, controller.dashboard);
  router.get("/buddy/session", authenticate, requireVerifiedAi, controller.buddySession);
  router.post("/buddy/messages", authenticate, requireVerifiedAi, aiWriteLimiter, controller.sendBuddyMessage);
  router.get("/buddy/history", authenticate, requireVerifiedAi, controller.buddyHistory);
  router.get("/insights/emotions", authenticate, controller.emotionInsights);
  router.post("/grounding/sessions", authenticate, aiWriteLimiter, controller.completeGrounding);
  return router;
}
