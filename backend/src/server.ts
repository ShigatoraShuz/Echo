import { httpOnlyMode } from "./config/http-only-mode.js";
import { DataExportService } from "./features/settings/data-export.service.js";
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
import { JournalImagesService } from "./features/journals/journal-images.service.js";
import { SettingsService } from "./features/settings/settings.service.js";
import { ExperienceService } from "./features/experience/experience.service.js";
import { VerificationService } from "./features/verification/verification.service.js";
import { OnboardingService } from "./features/onboarding/onboarding.service.js";
import { NotificationService } from "./features/notifications/notifications.service.js";
import { PushSubscriptionsService } from "./features/notifications/push-subscriptions.service.js";
import { RegistrationService } from "./features/registration/registration.service.js";
import { AccessService } from "./features/access/access.service.js";
import { IdempotencyService } from "./infrastructure/idempotency/idempotency.service.js";
import { DevelopmentAnalysisRunner } from "./infrastructure/analysis/development-analysis.runner.js";
import { LocalWorkerService } from "./features/analysis/local-worker.service.js";
import { AnalysisMaintenanceService } from "./features/analysis/analysis-maintenance.service.js";
import { createRequestUserClient } from "./infrastructure/supabase/supabase-user.client.js";
import { ProfessionalService } from "./features/professionals/professional.service.js";
import { CalendarService } from "./features/calendar/calendar.service.js";
import { ProfessionalEventService } from "./features/professionals/professional-events.service.js";
import { startProfessionalEventProcessor } from "./features/professionals/professional-event-processor.js";

const environment = loadEnvironment();
const httpOnly = httpOnlyMode(environment.NODE_ENV, process.env.ECHO_HTTP_ONLY_MODE);
const supabaseAdmin = createSupabaseAdminClient(environment);
const encryptionService = createEncryptionService(
  environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
  environment.ENCRYPTION_PREVIOUS_KEYS_JSON,
);
const idempotencyService = new IdempotencyService(
  environment.IDEMPOTENCY_HMAC_ACTIVE_VERSION,
  environment.IDEMPOTENCY_HMAC_KEYS_JSON,
);
const developmentRunner = new DevelopmentAnalysisRunner(environment.AI_STUB_CONCURRENCY);
const backgroundJournalService = new JournalService(
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
  undefined,
  () => createRequestUserClient(environment),
);
const localWorkerService = new LocalWorkerService(
  supabaseAdmin,
  backgroundJournalService,
  environment.AI_WORKER_TOKEN ?? environment.IDEMPOTENCY_HMAC_KEYS_JSON[environment.IDEMPOTENCY_HMAC_ACTIVE_VERSION],
);
const dataExports = new DataExportService(supabaseAdmin, encryptionService);
const pushSubscriptions = environment.PUSH_VAPID_PUBLIC_KEY
  ? new PushSubscriptionsService(supabaseAdmin, encryptionService, true) : undefined;
const settingsService = new SettingsService(supabaseAdmin, () => createSupabasePublicServerClient(environment), () => createRequestUserClient(environment), dataExports, pushSubscriptions);
const experienceService = new ExperienceService(supabaseAdmin, journalService, encryptionService, {
  phq8IntervalDays: environment.PHQ8_INTERVAL_DAYS,
  supportThreshold: environment.SUPPORT_PROMPT_THRESHOLD,
  supportWindowDays: environment.SUPPORT_PROMPT_WINDOW_DAYS,
  supportCooldownDays: environment.SUPPORT_PROMPT_COOLDOWN_DAYS,
}, () => createRequestUserClient(environment));
const verificationService = new VerificationService(supabaseAdmin, encryptionService);
const onboardingService = new OnboardingService(supabaseAdmin, () => createRequestUserClient(environment));
const notificationService = new NotificationService(
  () => createRequestUserClient(environment),
  (userId, journalIds) => journalService.getJournalTitles(userId, journalIds),
);
const registrationService = new RegistrationService(
  supabaseAdmin,
  () => createSupabasePublicServerClient(environment),
  environment.SIGNUP_DRAFT_SECRET ?? environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.GOOGLE_WEB_CLIENT_ID,
  environment.FRONTEND_URL,
);
const accessService = new AccessService(supabaseAdmin, () => createRequestUserClient(environment));
const verifier = createSupabaseAccessTokenVerifier(supabaseAdmin, environment.SUPABASE_URL);
const professionalService = new ProfessionalService(supabaseAdmin, encryptionService, journalService, experienceService);
const calendarService = new CalendarService(supabaseAdmin, encryptionService);
const app = createApp({
  allowedOrigin: environment.FRONTEND_URL,
  bodyLimit: environment.REQUEST_BODY_LIMIT,
  trustedProxyAddresses: environment.TRUSTED_PROXY_ADDRESSES.split(",").map((value) => value.trim()).filter(Boolean),
  securityAuditSink: async (event) => {
    const { error } = await supabaseAdmin.schema("user_service").from("security_events").insert({
      event_type: event.event, request_id: event.requestId, actor_hash: event.actorHash,
      outcome: event.outcome, status_code: event.statusCode,
    });
    if (error) throw new Error("Security audit delivery failed.");
  },
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
      pushSubscriptions,
    },
    calendar: { service: calendarService, verifier },
    professionals: { service: professionalService, verifier, verificationService },
  },
});

const server = app.listen(environment.PORT, httpOnly ? "127.0.0.1" : "0.0.0.0", () => {
  console.info(JSON.stringify({ service: "backend", event: "started", port: environment.PORT }));
});
const professionalEvents = startProfessionalEventProcessor(new ProfessionalEventService(supabaseAdmin), {
  enabled: environment.PROFESSIONAL_EVENTS_ENABLED,
  httpOnly,
  report: event => console.info(JSON.stringify({ service: "professional-events", ...event })),
});
const maintenance = new AnalysisMaintenanceService(supabaseAdmin);
const reportMaintenanceFailure = () =>
  console.warn(JSON.stringify({ service: "backend", event: "analysis_maintenance_failed" }));
let maintenanceTimer: ReturnType<typeof setInterval> | undefined;
if (!httpOnly) {
void backgroundJournalService.recoverDevelopmentJobs().catch(reportMaintenanceFailure);
void dataExports.expire().catch(reportMaintenanceFailure);
maintenanceTimer = setInterval(() => {
  void new JournalImagesService(supabaseAdmin).cleanup().catch(reportMaintenanceFailure);
  void maintenance.tick().catch(reportMaintenanceFailure);
  void dataExports.expire().catch(reportMaintenanceFailure);
  if (environment.AI_ANALYSIS_MODE === "local_worker")
    void localWorkerService.recover().catch(reportMaintenanceFailure);
}, 30_000);
maintenanceTimer.unref();
if (environment.AI_ANALYSIS_MODE === "local_worker") void localWorkerService.recover().catch(reportMaintenanceFailure);

} else {
  console.info(JSON.stringify({ service: "backend", event: "development_http_only", backgroundMaintenance: false }));
}

function shutdown(signal: string): void {
  console.info(JSON.stringify({ service: "backend", event: "shutdown", signal }));
  developmentRunner.stop();
  void professionalEvents.stop();
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
