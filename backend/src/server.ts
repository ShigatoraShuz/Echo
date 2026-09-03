import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createAnalysisProvider } from "./infrastructure/analysis/analysis-provider.factory.js";
import { createEncryptionService } from "./infrastructure/encryption/encryption.service.js";
import {
  createSupabaseAccessTokenVerifier,
  createSupabaseAdminClient,
  createSupabasePublicServerClient,
} from "./infrastructure/supabase/supabase-admin.client.js";
import { JournalService } from "./features/journals/journals.service.js";
import { SettingsService } from "./features/settings/settings.service.js";
import { ExperienceService } from "./features/experience/experience.service.js";
import { VerificationService } from "./features/verification/verification.service.js";
import { OnboardingService } from "./features/onboarding/onboarding.service.js";
import { NotificationService } from "./features/notifications/notifications.service.js";
import { RegistrationService } from "./features/registration/registration.service.js";
import { AccessService } from "./features/access/access.service.js";
import { IdempotencyService } from "./infrastructure/idempotency/idempotency.service.js";
import { DevelopmentAnalysisRunner } from "./infrastructure/analysis/development-analysis.runner.js";
import { LocalWorkerService } from "./features/analysis/local-worker.service.js";
import { AnalysisMaintenanceService } from "./features/analysis/analysis-maintenance.service.js";

const environment = loadEnvironment();
const supabaseAdmin = createSupabaseAdminClient(environment);
const encryptionService = createEncryptionService(
  environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
);
const idempotencyService = new IdempotencyService(
  environment.IDEMPOTENCY_HMAC_ACTIVE_VERSION,
  environment.IDEMPOTENCY_HMAC_KEYS_JSON,
);
const developmentRunner = new DevelopmentAnalysisRunner(environment.AI_STUB_CONCURRENCY);
const journalService = new JournalService(
  supabaseAdmin,
  encryptionService,
  createAnalysisProvider(environment),
  idempotencyService,
  {
    mode: environment.AI_ANALYSIS_MODE,
    developmentUserIds: new Set(
      environment.AI_DEVELOPMENT_USER_IDS.split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
    timeoutMs: environment.AI_JOB_TIMEOUT_MS,
    isProduction: environment.NODE_ENV === "production",
  },
  developmentRunner,
);
const localWorkerService = new LocalWorkerService(
  supabaseAdmin,
  journalService,
  environment.AI_WORKER_TOKEN ?? environment.IDEMPOTENCY_HMAC_KEYS_JSON[environment.IDEMPOTENCY_HMAC_ACTIVE_VERSION],
);
const settingsService = new SettingsService(supabaseAdmin);
const experienceService = new ExperienceService(supabaseAdmin, journalService, encryptionService);
const verificationService = new VerificationService(supabaseAdmin, encryptionService);
const onboardingService = new OnboardingService(supabaseAdmin);
const notificationService = new NotificationService(
  supabaseAdmin,
  (userId, journalIds) => journalService.getJournalTitles(userId, journalIds),
);
const registrationService = new RegistrationService(
  supabaseAdmin,
  createSupabasePublicServerClient(environment),
  environment.SIGNUP_DRAFT_SECRET ?? environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.GOOGLE_WEB_CLIENT_ID,
  environment.FRONTEND_URL,
);
const accessService = new AccessService(supabaseAdmin);
const verifier = createSupabaseAccessTokenVerifier(supabaseAdmin);
const app = createApp({
  allowedOrigin: environment.FRONTEND_URL,
  bodyLimit: environment.REQUEST_BODY_LIMIT,
  v1: {
    ...(environment.AI_ANALYSIS_MODE === "local_worker" ? { localWorker: { service: localWorkerService } } : {}),
    registration: { service: registrationService, allowedOrigin: environment.FRONTEND_URL },
    access: { service: accessService, verifier },
    journals: {
      service: journalService,
      verifier,
      verificationService,
    },
    settings: {
      service: settingsService,
      verifier,
    },
    experience: {
      service: experienceService,
      verifier,
      verificationService,
    },
    verification: {
      service: verificationService,
      verifier,
    },
    onboarding: {
      service: onboardingService,
      verifier,
    },
    notifications: {
      service: notificationService,
      verifier,
    },
  },
});

const server = app.listen(environment.PORT, () => {
  console.info(JSON.stringify({ service: "backend", event: "started", port: environment.PORT }));
});
const maintenance = new AnalysisMaintenanceService(supabaseAdmin);
const reportMaintenanceFailure = () =>
  console.warn(JSON.stringify({ service: "backend", event: "analysis_maintenance_failed" }));
void journalService.recoverDevelopmentJobs().catch(reportMaintenanceFailure);
const maintenanceTimer = setInterval(() => {
  void maintenance.tick().catch(reportMaintenanceFailure);
  if (environment.AI_ANALYSIS_MODE === "local_worker")
    void localWorkerService.recover().catch(reportMaintenanceFailure);
}, 30_000);
maintenanceTimer.unref();
if (environment.AI_ANALYSIS_MODE === "local_worker") void localWorkerService.recover().catch(reportMaintenanceFailure);

function shutdown(signal: string): void {
  console.info(JSON.stringify({ service: "backend", event: "shutdown", signal }));
  developmentRunner.stop();
  clearInterval(maintenanceTimer);
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
