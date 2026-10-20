import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";
import { createEncryptionService } from "../src/infrastructure/encryption/encryption.service.js";
import { migrateEncryptedText, type TextMigrationRow } from "../src/infrastructure/encryption/text-migration.js";

const environment = loadEnvironment();
const projectRef = new URL(environment.SUPABASE_URL).hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
if (!projectRef) throw new Error("This operator requires an explicit Supabase project URL.");

const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((argument) => argument.startsWith("--confirm-project="))?.split("=")[1];
if (apply && confirmation !== projectRef) {
  throw new Error("To write live Buddy data, pass --apply --confirm-project=<linked project ref>.");
}

const database = createSupabaseAdminClient(environment);
const encryption = createEncryptionService(
  environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
  environment.ENCRYPTION_PREVIOUS_KEYS_JSON,
);

const store = {
  async page(after?: string): Promise<TextMigrationRow[]> {
    let query = database.schema("buddy_service").from("buddy_messages")
      .select("id,user_id,content").order("id").limit(100);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(`Buddy message read failed (${error.code}).`);
    return data ?? [];
  },
  async replace(row: TextMigrationRow, digest: string, ciphertext: string): Promise<boolean> {
    const { data, error } = await database.schema("buddy_service").rpc("replace_message_ciphertext", {
      p_id: row.id, p_user_id: row.user_id, p_expected_digest: digest, p_ciphertext: ciphertext,
    });
    if (error) throw new Error(`Buddy message replacement failed (${error.code}).`);
    return data === true;
  },
};

const result = await migrateEncryptedText(store, encryption, environment.JOURNAL_ENCRYPTION_KEY_VERSION, apply);
const verification = apply
  ? await migrateEncryptedText(store, encryption, environment.JOURNAL_ENCRYPTION_KEY_VERSION)
  : null;
process.stdout.write(`${JSON.stringify({
  event: "buddy_ciphertext_live_backfill", projectRef, apply, ...result,
  ...(verification ? { remaining: verification.needsMigration, unreadableAfter: verification.unreadable } : {}),
})}\n`);
if (result.unreadable || result.conflicts || verification?.needsMigration || verification?.unreadable) process.exitCode = 2;
