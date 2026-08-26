import { Router } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createDashboardController } from "./dashboard.controller.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardRouter(
  service: DashboardService,
  verifier: AccessTokenVerifier,
): Router {
  const controller = createDashboardController(service);
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);
  router.get("/dashboard", authenticate, controller.dashboard);
  return router;
}
