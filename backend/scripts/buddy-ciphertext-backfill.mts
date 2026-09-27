import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";
import { createEncryptionService } from "../src/infrastructure/encryption/encryption.service.js";
import { migrateEncryptedText, type TextMigrationRow } from "../src/infrastructure/encryption/text-migration.js";
const environment=loadEnvironment();
// Never operate on remote data from this developer helper.
if(!["localhost","127.0.0.1","[::1]"].includes(new URL(environment.SUPABASE_URL).hostname))
 throw new Error("Only a disposable local synthetic database is allowed.");
const apply=process.argv.includes("--apply-synthetic");
const database=createSupabaseAdminClient(environment);
const encryption=createEncryptionService(environment.JOURNAL_ENCRYPTION_KEY_BASE64,environment.JOURNAL_ENCRYPTION_KEY_VERSION,environment.ENCRYPTION_PREVIOUS_KEYS_JSON);
const result=await migrateEncryptedText({
 async page(after){
  let query=database.schema("buddy_service").from("buddy_messages").select("id,user_id,content").order("id").limit(100);
  if(after)query=query.gt("id",after);
  const {data,error}=await query;if(error)throw new Error("Migration read failed.");return data as TextMigrationRow[];
 },
 async replace(row,digest,ciphertext){
  const {data,error}=await database.schema("buddy_service").rpc("replace_message_ciphertext",{p_id:row.id,p_user_id:row.user_id,p_expected_digest:digest,p_ciphertext:ciphertext});
  if(error)throw new Error("Migration write failed.");return data===true;
 }
},encryption,environment.JOURNAL_ENCRYPTION_KEY_VERSION,apply);
console.info(JSON.stringify({event:"buddy_ciphertext_migration",apply,...result}));
if(result.unreadable||result.conflicts)process.exitCode=2;
