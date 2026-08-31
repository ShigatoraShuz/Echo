import { loadEnvironment } from "../src/config/environment.js";
import { createEncryptionService } from "../src/infrastructure/encryption/encryption.service.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";
import { CiphertextBackfillService } from "../src/features/journals/ciphertext-backfill.service.js";

const environment = loadEnvironment();
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(environment.SUPABASE_URL).hostname))
  throw new Error("This validation command only operates on a disposable local database.");
const service = new CiphertextBackfillService(
  createSupabaseAdminClient(environment),
  createEncryptionService(environment.JOURNAL_ENCRYPTION_KEY_BASE64, environment.JOURNAL_ENCRYPTION_KEY_VERSION),
);
const coverage = await service.run();
console.info(JSON.stringify({ service: "journal-ciphertext-backfill", ...coverage }));
if (!coverage.complete) process.exitCode = 2;
