import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";
import { createEncryptionService, decryptText } from "../src/infrastructure/encryption/encryption.service.js";

const environment = loadEnvironment();
const database = createSupabaseAdminClient(environment);
const encryption = createEncryptionService(
  environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION,
  environment.ENCRYPTION_PREVIOUS_KEYS_JSON,
);
const words = (value: string) => [...new Set(value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];

async function searchIncludes(userId: string, conversationId: string, word: string): Promise<boolean> {
  for (let page = 1; ; page++) {
    const { data: matches, error } = await database.schema("buddy_service").rpc("search_history", {
      p_user_id: userId, p_hashes: [encryption.searchHashes(word)[0]], p_page: page, p_page_size: 50,
    });
    if (error) throw new Error(`Buddy search verification failed (${error.code}).`);
    if (matches?.some((match: { id: string }) => match.id === conversationId)) return true;
    if (!matches?.length || page * 50 >= Number(matches[0].total ?? 0)) return false;
  }
}

let conversationCount = 0;
let messageCount = 0;
let after = "";
for (;;) {
  let query = database.schema("buddy_service").from("buddy_conversations")
    .select("id,user_id,title,title_ciphertext,preview_ciphertext").order("id").limit(100);
  if (after) query = query.gt("id", after);
  const { data: conversations, error } = await query;
  if (error) throw new Error(`Buddy verification read failed (${error.code}).`);
  if (!conversations?.length) break;
  for (const conversation of conversations) {
    if (conversation.title !== "Buddy conversation" || !conversation.title_ciphertext) {
      throw new Error("A Buddy title still needs encryption backfill.");
    }
    const title = decryptText(conversation.title_ciphertext, encryption);
    const { data: messages, error: messagesError } = await database.schema("buddy_service").from("buddy_messages")
      .select("content,role,created_at").eq("conversation_id", conversation.id).eq("user_id", conversation.user_id)
      .order("created_at").order("role", { ascending: false }).order("id");
    if (messagesError) throw new Error(`Buddy message verification read failed (${messagesError.code}).`);
    const plaintextMessages = (messages ?? []).map((message) => decryptText(message.content, encryption));
    if (plaintextMessages.length) {
      if (!conversation.preview_ciphertext ||
        decryptText(conversation.preview_ciphertext, encryption) !== plaintextMessages.at(-1)!.slice(0, 120)) {
        throw new Error(`A Buddy preview does not match its latest message (conversation ${conversationCount + 1}, last role ${messages?.at(-1)?.role}).`);
      }
    }
    for (const text of [title, ...plaintextMessages]) {
      const firstWord = words(text)[0];
      if (!firstWord) continue;
      if (!(await searchIncludes(conversation.user_id, conversation.id, firstWord)))
        throw new Error("A Buddy search projection is incomplete.");
    }
    conversationCount++;
    messageCount += plaintextMessages.length;
  }
  after = conversations.at(-1)!.id;
}
process.stdout.write(`${JSON.stringify({ event: "buddy_history_verified", conversations: conversationCount, messages: messageCount })}\n`);
