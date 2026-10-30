import { consultationOrigin } from "./lib/consultation-origin.mts";
/** Explicit isolated fixture provisioning. Never imported by the application. */
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { localEnvironment, localFetch, LOCAL_API, FIXTURE_TAG, assertFixtureUser } from "./lib/professional-local-target.mts";
import { RegistrationService } from "../src/features/registration/registration.service.js";
import { OnboardingService } from "../src/features/onboarding/onboarding.service.js";

const root = process.cwd(), target = localEnvironment(root);
const base = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
if (base.tag !== FIXTURE_TAG || base.fingerprint !== target.fingerprint || !base.complete || base.retired) throw new Error("Fixture mismatch");
const directory = "backend/tmp/student-consultation", path = `${directory}/state.json`;
mkdirSync(directory, { recursive: true });
const state = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {
  tag: "echo-student-consultation-v1", fingerprint: target.fingerprint,
  accounts: ["student-a", "student-b"].map(name => ({ email: `consultation-${name}-20261030@professional.echo.test`, password: randomBytes(30).toString("base64url") + "aA1!" })),
};
if (state.tag !== "echo-student-consultation-v1" || state.fingerprint !== target.fingerprint) throw new Error("Consultation target mismatch");
const save = () => writeFileSync(path, JSON.stringify(state, null, 2), { mode: 0o600 });
save();
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } };
const database = createClient(LOCAL_API, target.serviceKey, options);
const checked = <T>(result: { data: T; error: unknown }): T => { if (result.error) throw new Error("Local fixture operation failed; private diagnostics suppressed"); return result.data; };
const registration = new RegistrationService(database, () => createClient(LOCAL_API, target.anonKey, options), base.registrationSecret, "", consultationOrigin());
const onboarding = new OnboardingService(database);
for (const account of state.accounts) {
  localEnvironment(root); // Verify before EACH account's write sequence.
  if (!account.id) {
    const users = checked(await database.auth.admin.listUsers({ page: 1, perPage: 1000 })).users;
    if (users.length >= 1000 || users.some((user: { email: string }) => user.email === account.email)) throw new Error("Account collision; existing account preserved");
    const policies = await registration.activePolicies();
    const eligibility = await registration.startEligibility("1990-01-01");
    if (!eligibility.credentials) throw new Error("Synthetic adult registration failed");
    const accepted = await registration.acceptAgreements(eligibility.credentials.token, eligibility.credentials.csrf, {
      reviewedDocumentIds: policies.map(p => String(p.id)), termsAccepted: true, privacyAccepted: true,
      aiNoticeAccepted: true, optionalAiAnalysis: true,
    });
    const hash = (value: string) => createHmac("sha256", base.registrationSecret).update(value).digest("hex");
    const rows = checked(await database.rpc("echo_registration_get_draft", { draft_token_hash: hash(accepted.token) }));
    const draft = Array.isArray(rows) ? rows[0] : rows;
    const reservation = randomUUID();
    if (checked(await database.rpc("echo_registration_update_draft", {
      draft_id: draft.id, expected_token_hash: hash(accepted.token), expected_state: "account",
      changes: { email: account.email, reservation_id: reservation, state: "verification_pending", verification_sent_at: new Date().toISOString() },
    })) !== true) throw new Error("Registration reservation failed");
    const created = checked(await database.auth.admin.createUser({ email: account.email, password: account.password,
      email_confirm: true, user_metadata: { signup_reservation: reservation }, app_metadata: { fixture: FIXTURE_TAG, consultation_demo: true } }));
    account.id = created.user.id; save();
  }
  assertFixtureUser(checked(await database.auth.admin.getUserById(account.id)).user, account.email);
  if (!account.ready) {
    await onboarding.saveProfile(account.id, { preferredName: "Fictional Consultation Student", timezone: "Asia/Taipei" });
    await onboarding.saveSetup(account.id, { genderIdentity: "prefer_not_to_say", pronouns: "use_my_name", notifications: false, facialAnalysis: false });
    await onboarding.completeOnboarding(account.id);
    // Trusted synthetic identity precondition, never a real credential review or application role.
    const existing = checked(await database.schema("verification_service").from("identity_verifications").select("id").eq("user_id", account.id).maybeSingle());
    if (existing) throw new Error("Unexpected existing verification; preserved");
    checked(await database.schema("verification_service").from("identity_verifications").insert({ user_id: account.id,
      verification_status: "approved", reviewed_at: new Date().toISOString(), approved_expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }));
    checked(await database.schema("user_service").from("audit_events").insert({ user_id: account.id,
      event_type: "test_fixture.identity_precondition", resource_type: "identity_verification",
      metadata: { synthetic: true, purpose: "Local consultation fictional fixture; not a real identity review" } }));
    account.ready = true; save();
  }
}
process.stdout.write(JSON.stringify({ ready: true, target: LOCAL_API, fingerprint: target.fingerprint, accounts: state.accounts.map((a: { id: string; email: string }) => ({ id: a.id, email: a.email })) }) + "\n");
