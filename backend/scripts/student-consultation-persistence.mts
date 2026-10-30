/** Read-only evidence checks against the exact existing local fictional journey records. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { localEnvironment, localFetch, LOCAL_API, FIXTURE_TAG, assertFixtureUser } from "./lib/professional-local-target.mts";
import { createEncryptionService, decryptText } from "../src/infrastructure/encryption/encryption.service.js";

const target = localEnvironment(process.cwd());
const base = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
const fixtures = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (base.tag !== FIXTURE_TAG || base.fingerprint !== target.fingerprint || fixtures.fingerprint !== target.fingerprint) throw new Error("Fixture mismatch");
const evidence = "artifacts/model-integration/student-completion-20261030";
const report = JSON.parse(readFileSync(`${evidence}/browser-results.json`, "utf8"));
assert.equal(report.failure, undefined);
const database = createClient(LOCAL_API, target.serviceKey, { auth: { persistSession: false }, global: { fetch: localFetch } });
const encryption = createEncryptionService(base.encryptionKey, 1);
const checks = [];
for (const journey of report.journeys) {
  const fixture = fixtures.accounts.find((a: { id: string }) => a.id === journey.studentId);
  if (!fixture) throw new Error("Nonfixture record refused");
  const user = await database.auth.admin.getUserById(fixture.id);
  if (user.error || !user.data.user) throw new Error("Fixture not found");
  assertFixtureUser(user.data.user, fixture.email);
  const journal = await database.schema("journal_service").from("journals").select("content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version").eq("id", journey.journalId).eq("user_id", fixture.id).single();
  assert.equal(journal.error, null);
  assert.ok(journal.data!.content_ciphertext && journal.data!.encryption_iv && journal.data!.encryption_auth_tag);
  const phq = await database.schema("insights_service").from("phq8_assessments").select("assessment_ciphertext,responses,score,severity").eq("user_id", fixture.id).eq("id", journey.phq8.id).single();
  assert.equal(phq.error, null);
  assert.deepEqual([phq.data!.responses, phq.data!.score, phq.data!.severity], [null, null, null]);
  const opened = JSON.parse(decryptText(phq.data!.assessment_ciphertext, encryption));
  assert.equal(opened.userId, fixture.id); assert.deepEqual(opened.responses, journey.phq8.responses);
  const messages = await database.schema("buddy_service").from("buddy_messages").select("role,content").eq("user_id", fixture.id).eq("conversation_id", journey.buddy.conversationId);
  assert.equal(messages.error, null); assert.ok(messages.data!.length >= 2);
  for (const row of messages.data!) {
    assert.ok(row.content.startsWith("echo:encrypted:v1:"));
    if (row.role !== "user") assert.equal(JSON.parse(decryptText(row.content, encryption)).generation.executionState, "DEMO_FALLBACK");
  }
  checks.push({ studentId: fixture.id, journalCiphertext: true, selfReportCiphertextOnly: true, actualSelectedResponsesPreserved: true, buddyCiphertextWithProvenance: true });
}
assert.deepEqual(report.journeys[0].research.rawLogits, report.journeys[1].research.rawLogits);
writeFileSync(`${evidence}/persistence-results.json`, JSON.stringify({ target: LOCAL_API, fingerprint: target.fingerprint, checks, identicalRawLogitsAcrossBrowsers: true }, null, 2));
process.stdout.write("Both fictional students: encrypted journal, PHQ-8 and Buddy persistence verified. Desktop/mobile raw logits identical.\n");
