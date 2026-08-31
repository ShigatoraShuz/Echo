import { createOwnedDatabase, env, listen, positiveIntegerEnv, secretEnv } from "@echo/service-core";
import { createUserApp } from "./app.js";
import { createEncryptionService } from "./infrastructure/encryption/encryption.service.js";
import { OnboardingService } from "./features/onboarding/onboarding.service.js";
import { SettingsService } from "./features/settings/settings.service.js";
import { VerificationService } from "./features/verification/verification.service.js";

const database = createOwnedDatabase({
  url: env("SUPABASE_URL"),
  key: env("SUPABASE_DATABASE_KEY"),
  tables: [
    "profiles",
    "user_consents",
    "notification_preferences",
    "privacy_preferences",
    "trusted_contacts",
    "data_export_requests",
    "account_deletion_requests",
    "notifications",
    "verification_admins",
    "identity_verifications",
    "verification_documents",
    "verification_reviews",
    "audit_events",
  ],
});
const storage = createOwnedDatabase({
  url: env("SUPABASE_URL"),
  key: env("USER_STORAGE_KEY"),
  tables: [],
}).storage;
const encryption = createEncryptionService(env("JOURNAL_ENCRYPTION_KEY_BASE64"), positiveIntegerEnv("JOURNAL_ENCRYPTION_KEY_VERSION", 1));
const dependencies = {
  onboarding: new OnboardingService(database),
  settings: new SettingsService(database, storage),
  verification: new VerificationService(database, storage, encryption),
  database,
};
const port = positiveIntegerEnv("PORT", 4201);
listen(createUserApp(dependencies, { internalToken: secretEnv("USER_SERVICE_TOKEN"), allowedOrigin: process.env.FRONTEND_URL }), { name: "user-service", port });
