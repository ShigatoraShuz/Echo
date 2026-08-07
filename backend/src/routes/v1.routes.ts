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
  experience?: {
    service: ExperienceService;
    verifier: AccessTokenVerifier;
    verificationService: VerificationService;
  };
  verification?: {
    service: VerificationService;
    verifier: AccessTokenVerifier;
  };
}

export function createV1Router(options: V1RouterOptions = {}): Router {
  const router = Router();
  router.use(createHealthRouter());
  if (options.journals) router.use(createJournalsRouter(options.journals.service, options.journals.verifier, options.journals.verificationService));
  if (options.settings) router.use(createSettingsRouter(options.settings.service, options.settings.verifier));
  if (options.experience) router.use(createExperienceRouter(options.experience.service, options.experience.verifier, options.experience.verificationService));
  if (options.verification) router.use(createVerificationRouter(options.verification.service, options.verification.verifier));
  return router;
}
