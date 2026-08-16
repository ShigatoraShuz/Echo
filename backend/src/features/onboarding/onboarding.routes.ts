import { Router } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createOnboardingController } from "./onboarding.controller.js";
import type { OnboardingService } from "./onboarding.service.js";

export function createOnboardingRouter(service: OnboardingService, verifier: AccessTokenVerifier): Router {
  const controller = createOnboardingController(service);
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);

  router.get("/onboarding/status", authenticate, controller.getStatus);
  router.post("/onboarding/consent", authenticate, controller.saveConsent);
  router.post("/onboarding/profile", authenticate, controller.saveProfile);
  router.post("/onboarding/setup", authenticate, controller.saveSetup);
  router.post("/onboarding/complete", authenticate, controller.completeOnboarding);

  return router;
}
