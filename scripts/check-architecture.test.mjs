import assert from "node:assert/strict";
import test from "node:test";
import { referencedDatabaseTables, usesDirectSupabaseClient } from "./architecture-rules.mjs";

test("detects JavaScript, Python, and raw PostgREST table access", () => {
  assert.deepEqual(
    referencedDatabaseTables(`db.from("journals"); db.table('mood_entries'); fetch(\`${"${url}"}/rest/v1/journal_analyses?id=eq.1\`)`),
    ["journals", "mood_entries", "journal_analyses"],
  );
});

test("does not treat ordinary API routes as database access", () => {
  assert.deepEqual(referencedDatabaseTables('fetch("/api/v1/journals")'), []);
});

test("detects direct Supabase client construction", () => {
  assert.equal(usesDirectSupabaseClient("const db = createClient(url, key)"), true);
  assert.equal(usesDirectSupabaseClient("const db = createOwnedDatabase(options)"), false);
});
