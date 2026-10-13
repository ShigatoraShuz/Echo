import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";
import { createEncryptionService, decryptText, encryptText } from "../src/infrastructure/encryption/encryption.service.js";

const apply = process.argv.includes("--apply");
const environment = loadEnvironment();
const database = createSupabaseAdminClient(environment);
const encryption = createEncryptionService(
  environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
  environment.ENCRYPTION_PREVIOUS_KEYS_JSON,
);
const words = (value: string) => [...new Set(value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 256);
let after = "";
let conversations = 0;
let messages = 0;

while (true) {
  let query = database.schema("buddy_service").from("buddy_conversations")
    .select("id,user_id,title,title_ciphertext,preview_ciphertext").order("id").limit(100);
  if (after) query = query.gt("id", after);
  const { data: page, error } = await query;
  if (error) throw new Error("Buddy history backfill read failed.");
  if (!page?.length) break;
  for (const conversation of page) {
    const title = conversation.title_ciphertext
      ? decryptText(conversation.title_ciphertext, encryption)
      : conversation.title || "Buddy conversation";
    const allMessages: Array<{ id: string; content: string }> = [];
    for (let offset = 0; ; offset += 500) {
      const result = await database.schema("buddy_service").from("buddy_messages")
        .select("id,content").eq("user_id", conversation.user_id)
        .eq("conversation_id", conversation.id).order("created_at").order("id").range(offset, offset + 499);
      if (result.error) throw new Error("Buddy message backfill read failed.");
      allMessages.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 500) break;
    }
    const contents = allMessages.map((message) => decryptText(message.content, encryption));
    if (apply) {
      const { error: updateError } = await database.schema("buddy_service").from("buddy_conversations")
        .update({ title: "Buddy conversation", title_ciphertext: encryptText(title, encryption),
          preview_ciphertext: contents.length ? encryptText(contents[contents.length - 1].slice(0, 120), encryption) : null })
        .eq("id", conversation.id).eq("user_id", conversation.user_id);
      if (updateError) throw new Error("Buddy title backfill write failed.");
      const rows = [
        ...words(title).map((word) => ({ user_id: conversation.user_id, conversation_id: conversation.id,
          source_type: "title", source_id: conversation.id, token_hash: encryption.searchHashes(word)[0] })),
        ...allMessages.flatMap((message, index) => words(contents[index]).map((word) => ({
          user_id: conversation.user_id, conversation_id: conversation.id,
          source_type: "message", source_id: message.id, token_hash: encryption.searchHashes(word)[0],
        }))),
      ];
      const { error: clearIndexError } = await database.schema("buddy_service")
        .from("conversation_search_tokens").delete()
        .eq("user_id", conversation.user_id).eq("conversation_id", conversation.id);
      if (clearIndexError) throw new Error("Buddy search index reset failed.");
      for (let start = 0; start < rows.length; start += 500) {
        const { error: indexError } = await database.schema("buddy_service").from("conversation_search_tokens")
          .upsert(rows.slice(start, start + 500), {
            onConflict: "user_id,conversation_id,source_type,source_id,token_hash", ignoreDuplicates: true,
          });
        if (indexError) throw new Error("Buddy search backfill write failed.");
      }
      const { data: verified, error: verifyError } = await database.schema("buddy_service").from("buddy_conversations")
        .select("title,title_ciphertext").eq("id", conversation.id).eq("user_id", conversation.user_id).single();
      if (verifyError || verified?.title !== "Buddy conversation" || decryptText(verified.title_ciphertext, encryption) !== title)
        throw new Error("Buddy title backfill verification failed.");
    }
    conversations++;
    messages += allMessages.length;
  }
  after = page[page.length - 1].id;
}

if (apply) {
  const [plaintext, missingCiphertext] = await Promise.all([
    database.schema("buddy_service").from("buddy_conversations")
      .select("id", { count: "exact", head: true }).neq("title", "Buddy conversation"),
    database.schema("buddy_service").from("buddy_conversations")
      .select("id", { count: "exact", head: true }).is("title_ciphertext", null),
  ]);
  if (plaintext.error || missingCiphertext.error || plaintext.count || missingCiphertext.count)
    throw new Error("Buddy title backfill is incomplete; do not remove the compatibility column.");
}

process.stdout.write(`${JSON.stringify({ event: "buddy_history_backfill", apply, conversations, messages })}\n`);
