import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createGroundingController } from "./grounding.controller.js";
import type { GroundingService } from "./grounding.service.js";

export function createGroundingRouter(
  service: GroundingService,
  verifier: AccessTokenVerifier,
): Router {
  const controller = createGroundingController(service);
  const router = Router();

  // Grounding sessions carry database write costs,
  // so they get a stricter budget than the global rate limit.
  const aiWriteLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  const authenticate = createAuthMiddleware(verifier);
  router.post("/grounding/sessions", authenticate, aiWriteLimiter, controller.completeGrounding);
  return router;
}
