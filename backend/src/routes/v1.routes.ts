import { Router } from "express";
import { createHealthRouter } from "../features/health/health.routes.js";
import type { AccessTokenVerifier } from "../shared/middleware/auth.middleware.js";
import type { JournalService } from "../features/journals/journals.service.js";
import { createJournalsRouter } from "../features/journals/journals.routes.js";
import type { SettingsService } from "../features/settings/settings.service.js";
import { createSettingsRouter } from "../features/settings/settings.routes.js";
import type { ExperienceService } from "../features/experience/experience.service.js";
import { createExperienceRouter } from "../features/experience/experience.routes.js";
import type { VerificationService } from "../features/verification/verification.service.js";
import { createVerificationRouter } from "../features/verification/verification.routes.js";
import type { OnboardingService } from "../features/onboarding/onboarding.service.js";
import { createOnboardingRouter } from "../features/onboarding/onboarding.routes.js";
import type { NotificationService } from "../features/notifications/notifications.service.js";
import { createNotificationsRouter } from "../features/notifications/notifications.routes.js";
import type { RegistrationService } from "../features/registration/registration.service.js";
import { createRegistrationRouter } from "../features/registration/registration.routes.js";
import type { AccessService } from "../features/access/access.service.js";
import { createAccessGuard, createAccessRouter } from "../features/access/access.routes.js";
import { createAuthMiddleware } from "../shared/middleware/auth.middleware.js";

export interface V1RouterOptions {
  registration?: { service: RegistrationService; allowedOrigin: string };
  access?: { service: AccessService; verifier: AccessTokenVerifier };
  journals?: {
    service: JournalService;
    verifier: AccessTokenVerifier;
    verificationService: VerificationService;
  };
  settings?: {
    service: SettingsService;
    verifier: AccessTokenVerifier;
  };
  experience?: {
    service: ExperienceService;
    verifier: AccessTokenVerifier;
    verificationService: VerificationService;
  };
  verification?: {
    service: VerificationService;
    verifier: AccessTokenVerifier;
  };
  onboarding?: {
    service: OnboardingService;
    verifier: AccessTokenVerifier;
  };
  notifications?: {
    service: NotificationService;
    verifier: AccessTokenVerifier;
  };
}

export function createV1Router(options: V1RouterOptions = {}): Router {
  const router = Router();
  router.use(createHealthRouter());
  if (options.registration)
    router.use(createRegistrationRouter(options.registration.service, options.registration.allowedOrigin));
  if (options.access) {
    router.use(createAccessRouter(options.access.service, options.access.verifier));
    router.use(createAuthMiddleware(options.access.verifier), createAccessGuard(options.access.service));
  }
  if (options.journals)
    router.use(
      createJournalsRouter(options.journals.service, options.journals.verifier, options.journals.verificationService),
    );
  if (options.settings) router.use(createSettingsRouter(options.settings.service, options.settings.verifier));
  if (options.experience)
    router.use(
      createExperienceRouter(
        options.experience.service,
        options.experience.verifier,
        options.experience.verificationService,
      ),
    );
  if (options.verification)
    router.use(createVerificationRouter(options.verification.service, options.verification.verifier));
  if (options.onboarding) router.use(createOnboardingRouter(options.onboarding.service, options.onboarding.verifier));
  if (options.notifications)
    router.use(createNotificationsRouter(options.notifications.service, options.notifications.verifier));
  return router;
}
