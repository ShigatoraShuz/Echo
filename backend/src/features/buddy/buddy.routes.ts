import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createVerifiedAiAccessMiddleware } from "../verification/verification.middleware.js";
import type { VerificationService } from "../verification/verification.service.js";
import { createBuddyController } from "./buddy.controller.js";
import type { BuddyService } from "./buddy.service.js";

export function createBuddyRouter(
  service: BuddyService,
  verifier: AccessTokenVerifier,
  verificationService: VerificationService,
): Router {
  const controller = createBuddyController(service);
  const router = Router();

  // Buddy messages carry AI inference and database write costs,
  // so they get a stricter budget than the global rate limit.
  const aiWriteLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  const authenticate = createAuthMiddleware(verifier);
  const requireVerifiedAi = createVerifiedAiAccessMiddleware(verificationService);
  router.get("/buddy/session", authenticate, requireVerifiedAi, controller.buddySession);
  router.post("/buddy/messages", authenticate, requireVerifiedAi, aiWriteLimiter, controller.sendBuddyMessage);
  router.get("/buddy/history", authenticate, requireVerifiedAi, controller.buddyHistory);
  return router;
}
