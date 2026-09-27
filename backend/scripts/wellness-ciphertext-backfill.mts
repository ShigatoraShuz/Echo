import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";
import { createEncryptionService } from "../src/infrastructure/encryption/encryption.service.js";
import {
  migrateAssessments,
  type AssessmentMigrationRow,
} from "../src/infrastructure/encryption/wellness-migration.js";
const environment = loadEnvironment();
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(environment.SUPABASE_URL).hostname))
  throw new Error("Only a disposable local synthetic database is allowed.");
if (process.argv.slice(2).some((arg) => arg !== "--apply-synthetic")) throw new Error("Unknown migration argument.");
const apply = process.argv.includes("--apply-synthetic");
const database = createSupabaseAdminClient(environment);
const encryption = createEncryptionService(
  environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
  environment.ENCRYPTION_PREVIOUS_KEYS_JSON,
);
const result = await migrateAssessments(
  {
    async page(after) {
      let query = database
        .schema("insights_service")
        .from("phq8_assessments")
        .select("id,user_id,submission_id,assessment_ciphertext,responses,score,severity")
        .order("id")
        .limit(100);
      if (after) query = query.gt("id", after);
      const { data, error } = await query;
      if (error) throw new Error("Migration read failed.");
      return data as AssessmentMigrationRow[];
    },
    async replace(row, ciphertext) {
      const { data, error } = await database.schema("insights_service").rpc("replace_assessment_ciphertext", {
        p_id: row.id,
        p_user_id: row.user_id,
        p_submission_id: row.submission_id,
        p_expected_ciphertext: row.assessment_ciphertext,
        p_expected_responses: row.responses,
        p_expected_score: row.score,
        p_expected_severity: row.severity,
        p_ciphertext: ciphertext,
      });
      if (error) throw new Error("Migration write failed.");
      return data === true;
    },
  },
  encryption,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
  apply,
);
console.info(JSON.stringify({ event: "wellness_ciphertext_migration", apply, ...result }));
if (result.unreadable || result.conflicts) process.exitCode = 2;
