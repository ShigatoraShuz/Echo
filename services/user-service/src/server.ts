import { createClient } from "@supabase/supabase-js";
import { env, listen, positiveIntegerEnv, secretEnv } from "@echo/service-core";
import { createUserApp } from "./app.js";
import { createEncryptionService } from "./infrastructure/encryption/encryption.service.js";
import { OnboardingService } from "./features/onboarding/onboarding.service.js";
import { SettingsService } from "./features/settings/settings.service.js";
import { VerificationService } from "./features/verification/verification.service.js";

const database = createClient(env("SUPABASE_URL"), env("SUPABASE_DATABASE_KEY"), { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "public" } });
const encryption = createEncryptionService(env("JOURNAL_ENCRYPTION_KEY_BASE64"), positiveIntegerEnv("JOURNAL_ENCRYPTION_KEY_VERSION", 1));
const dependencies = { onboarding: new OnboardingService(database), settings: new SettingsService(database), verification: new VerificationService(database, encryption), database };
const port = positiveIntegerEnv("PORT", 4201);
listen(createUserApp(dependencies, { internalToken: secretEnv("USER_SERVICE_TOKEN"), allowedOrigin: process.env.FRONTEND_URL }), { name: "user-service", port });
