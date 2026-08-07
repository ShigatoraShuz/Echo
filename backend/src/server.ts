import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createAnalysisProvider } from "./infrastructure/analysis/analysis-provider.factory.js";
import { createEncryptionService } from "./infrastructure/encryption/encryption.service.js";
import { createSupabaseAccessTokenVerifier, createSupabaseAdminClient } from "./infrastructure/supabase/supabase-admin.client.js";
import { JournalService } from "./features/journals/journals.service.js";
import { SettingsService } from "./features/settings/settings.service.js";
import { ExperienceService } from "./features/experience/experience.service.js";
import { VerificationService } from "./features/verification/verification.service.js";

const environment = loadEnvironment();
const supabaseAdmin = createSupabaseAdminClient(environment);
const encryptionService = createEncryptionService(
  environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
);
const journalService = new JournalService(
  supabaseAdmin,
  encryptionService,
  createAnalysisProvider(environment),
);
const settingsService = new SettingsService(supabaseAdmin);
const experienceService = new ExperienceService(supabaseAdmin, journalService, encryptionService);
const verificationService = new VerificationService(supabaseAdmin, encryptionService);
const verifier = createSupabaseAccessTokenVerifier(supabaseAdmin);
const app = createApp({
  allowedOrigin: environment.FRONTEND_URL,
  bodyLimit: environment.REQUEST_BODY_LIMIT,
  v1: {
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
  },
});

const server = app.listen(environment.PORT, () => {
  console.info(JSON.stringify({ service: "backend", event: "started", port: environment.PORT }));
});

function shutdown(signal: string): void {
  console.info(JSON.stringify({ service: "backend", event: "shutdown", signal }));
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
