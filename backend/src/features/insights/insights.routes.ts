import { Router } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createInsightsController } from "./insights.controller.js";
import type { InsightsService } from "./insights.service.js";

export function createInsightsRouter(
  service: InsightsService,
  verifier: AccessTokenVerifier,
): Router {
  const controller = createInsightsController(service);
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);
  router.get("/insights/emotions", authenticate, controller.emotionInsights);
  return router;
}
