function print(value: unknown) {
  process.stdout.write((typeof value === "string" ? value : JSON.stringify(value)) + "\n");
}
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  localEnvironment,
  localFetch,
  LOCAL_API,
  FIXTURE_TAG,
  assertFixtureUser,
} from "./lib/professional-local-target.mts";

// Explicit TEST FIXTURE preconditions, not a real identity review or clinical credential.
// Runtime auth, ownership, consent and eligibility checks remain fully enabled.
const root = process.cwd(),
  target = localEnvironment(root);
const state = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
if (state.tag !== FIXTURE_TAG || state.fingerprint !== target.fingerprint || !state.complete || state.retired)
  throw new Error("Fixture mismatch");
const database = createClient(LOCAL_API, target.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: localFetch },
});
const userId = state.accounts.client.id;
const user = await database.auth.admin.getUserById(userId);
if (user.error || !user.data.user) throw new Error("Fixture user missing");
assertFixtureUser(user.data.user, "client@professional.echo.test");
const existing = await database
  .schema("verification_service")
  .from("identity_verifications")
  .select("id,verification_status")
  .eq("user_id", userId)
  .maybeSingle();
if (existing.error) throw new Error("Fixture eligibility lookup failed");
if (!existing.data) {
  localEnvironment(root);
  const seeded = await database
    .schema("verification_service")
    .from("identity_verifications")
    .insert({
      user_id: userId,
      verification_status: "approved",
      reviewed_at: new Date().toISOString(),
      approved_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    .select("id")
    .single();
  if (seeded.error) throw new Error("Synthetic identity gate fixture failed");
  const audit = await database
    .schema("user_service")
    .from("audit_events")
    .insert({
      user_id: userId,
      event_type: "test_fixture.identity_precondition",
      resource_type: "identity_verification",
      resource_id: seeded.data.id,
      metadata: { synthetic: true, purpose: "local AI application integration; not a real identity review" },
    });
  if (audit.error) throw new Error("Synthetic fixture audit failed");
} else if (existing.data.verification_status !== "approved")
  throw new Error("Existing nonapproved state preserved; no automatic override");
mkdirSync("backend/tmp/model-integration", { recursive: true });
writeFileSync(
  "backend/tmp/model-integration/state.json",
  JSON.stringify(
    {
      tag: "echo-model-local-v1",
      fingerprint: target.fingerprint,
      userId,
      otherUserId: state.accounts["org-admin"].id,
      identityIsSyntheticFixture: true,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
print(
  "Local synthetic identity preconditions ready. No real verification, clinical role, MFA or shared account was changed.",
);
