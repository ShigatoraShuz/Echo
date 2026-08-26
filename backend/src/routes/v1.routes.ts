import { Router } from "express";
import { createHealthRouter } from "../features/health/health.routes.js";
import type { AccessTokenVerifier } from "../shared/middleware/auth.middleware.js";
import type { JournalService } from "../features/journals/journals.service.js";
import { createJournalsRouter } from "../features/journals/journals.routes.js";
import type { SettingsService } from "../features/settings/settings.service.js";
import { createSettingsRouter } from "../features/settings/settings.routes.js";
import type { BuddyService } from "../features/buddy/buddy.service.js";
import { createBuddyRouter } from "../features/buddy/buddy.routes.js";
import type { DashboardService } from "../features/dashboard/dashboard.service.js";
import { createDashboardRouter } from "../features/dashboard/dashboard.routes.js";
import type { InsightsService } from "../features/insights/insights.service.js";
import { createInsightsRouter } from "../features/insights/insights.routes.js";
import type { GroundingService } from "../features/grounding/grounding.service.js";
import { createGroundingRouter } from "../features/grounding/grounding.routes.js";
import type { SupportResourcesService } from "../features/support-resources/support-resources.service.js";
import { createSupportResourcesRouter } from "../features/support-resources/support-resources.routes.js";
import type { VerificationService } from "../features/verification/verification.service.js";
import { createVerificationRouter } from "../features/verification/verification.routes.js";
import type { OnboardingService } from "../features/onboarding/onboarding.service.js";
import { createOnboardingRouter } from "../features/onboarding/onboarding.routes.js";

export interface V1RouterOptions {
  journals?: {
    service: JournalService;
    verifier: AccessTokenVerifier;
    verificationService: VerificationService;
  };
  settings?: {
    service: SettingsService;
    verifier: AccessTokenVerifier;
  };
  buddy?: {
    service: BuddyService;
    verifier: AccessTokenVerifier;
    verificationService: VerificationService;
  };
  dashboard?: {
    service: DashboardService;
    verifier: AccessTokenVerifier;
  };
  insights?: {
    service: InsightsService;
    verifier: AccessTokenVerifier;
  };
  grounding?: {
    service: GroundingService;
    verifier: AccessTokenVerifier;
  };
  supportResources?: {
    service: SupportResourcesService;
  };
  verification?: {
    service: VerificationService;
    verifier: AccessTokenVerifier;
  };
  onboarding?: {
    service: OnboardingService;
    verifier: AccessTokenVerifier;
  };
}

export function createV1Router(options: V1RouterOptions = {}): Router {
  const router = Router();
  router.use(createHealthRouter());
  if (options.journals) router.use(createJournalsRouter(options.journals.service, options.journals.verifier, options.journals.verificationService));
  if (options.settings) router.use(createSettingsRouter(options.settings.service, options.settings.verifier));
  if (options.buddy) router.use(createBuddyRouter(options.buddy.service, options.buddy.verifier, options.buddy.verificationService));
  if (options.dashboard) router.use(createDashboardRouter(options.dashboard.service, options.dashboard.verifier));
  if (options.insights) router.use(createInsightsRouter(options.insights.service, options.insights.verifier));
  if (options.grounding) router.use(createGroundingRouter(options.grounding.service, options.grounding.verifier));
  if (options.supportResources) router.use(createSupportResourcesRouter(options.supportResources.service));
  if (options.verification) router.use(createVerificationRouter(options.verification.service, options.verification.verifier));
  if (options.onboarding) router.use(createOnboardingRouter(options.onboarding.service, options.onboarding.verifier));
  return router;
}
