/** Privileged offline fixture provisioning. Never loaded by the application or automatic seed. */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type User } from "@supabase/supabase-js";
import type { Request, Response } from "express";
import { provisionVerificationAdmin } from "./lib/verification-admin.mjs";
import { FIXTURE_TAG, LOCAL_API, assertFixtureUser, localEnvironment, localFetch, localSql } from "./lib/professional-local-target.mts";
import { RegistrationService } from "../src/features/registration/registration.service.js";
import { OnboardingService } from "../src/features/onboarding/onboarding.service.js";
import { ProfessionalService } from "../src/features/professionals/professional.service.js";
import type { JournalService } from "../src/features/journals/journals.service.js";
import { createEncryptionService, encryptText } from "../src/infrastructure/encryption/encryption.service.js";
import { createSupabaseAccessTokenVerifier } from "../src/infrastructure/supabase/supabase-admin.client.js";
import { requireMfa } from "../src/shared/middleware/assurance.middleware.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = new URL("../tmp/professional-fixtures/", import.meta.url);
const statePath = new URL("state.json", directory);
const lockPath = new URL("setup.lock", directory);
const identities = ["client", "approved-a", "approved-b", "pending", "suspended", "org-admin", "reviewer"] as const;
type Identity = typeof identities[number];
type Account = { id?: string; password: string; ready?: boolean };
type State = {
  tag: string; fingerprint: string; encryptionKey: string; registrationSecret: string;
  expiresAt: string; accounts: Partial<Record<Identity, Account>>; organizations: Record<string, string>;
  complete?: boolean; retired?: boolean;
};
const email = (name: Identity) => `${name}@professional.echo.test`;
const label = "FICTIONAL credential - local testing only";
function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message); return value;
}
function checked<T extends { data: unknown; error: unknown }>(result: T, operation: string): T["data"] {
  if (result.error) {
    const code = String((result.error as { code?: string }).code ?? "unknown");
    throw new Error(`${operation} failed (${/^[A-Z0-9_]+$/i.test(code) ? code : "unknown"}); private diagnostics suppressed.`);
  }
  return result.data;
}
async function main() {
  const action = process.argv[2];
  if (!["setup", "check", "inspect", "cleanup"].includes(action ?? "") || process.argv.length !== 3) {
    throw new Error("Usage: node --import tsx backend/scripts/professional-local-fixtures.mts setup|check|inspect|cleanup");
  }
  const env = localEnvironment(root);
  const migrationNames = (await readdir(new URL("../../supabase/migrations/", import.meta.url)))
    .filter((name) => /^\d+_professional_.*\.sql$/.test(name));
  const ledger = new Set(localSql("select version from supabase_migrations.schema_migrations;").split(/\r?\n/));
  if (migrationNames.some((name) => !ledger.has(name.split("_")[0]))) throw new Error("Pending professional migrations: no fixtures written.");
  await mkdir(directory, { recursive: true });
  const lock = await open(lockPath, "wx").catch(() => { throw new Error("Fixture setup lock exists. Check for a running setup before removing the lock."); });
  try {
    let state: State;
    try { state = JSON.parse(await readFile(statePath, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || action !== "setup") throw new Error("Fixture state unavailable. Run setup first; do not overwrite an existing manifest.");
      state = { tag: FIXTURE_TAG, fingerprint: env.fingerprint, encryptionKey: randomBytes(32).toString("base64"),
        registrationSecret: randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10),
        accounts: {}, organizations: {} };
    }
    if (state.tag !== FIXTURE_TAG || state.fingerprint !== env.fingerprint) throw new Error("Manifest belongs to another database; refusing writes.");
    if (action === "setup" && state.retired) throw new Error("Fixtures were retired. Setup will not silently restore access; see cleanup documentation.");
    const save = async () => {
      const temporary = new URL("state.next.json", directory);
      await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
      await rename(temporary, statePath);
    };
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: localFetch } };
    const database = createClient(LOCAL_API, env.serviceKey, options);
    if (action === "setup") {
      // The older architecture migration overrides config.toml's schema list.
      // Local-only repair after target/manifest verification; no privilege grants.
      localSql(`do $$ declare schemas text; begin
        select substring(setting from length('pgrst.db_schemas=')+1) into schemas
          from pg_roles cross join lateral unnest(rolconfig) setting
          where rolname='authenticator' and setting like 'pgrst.db_schemas=%';
        if schemas is not null and not ('professional_service'=any(string_to_array(schemas,','))) then
          execute format('alter role authenticator set pgrst.db_schemas = %L', schemas||',professional_service');
        end if;
      end $$;
      notify pgrst, 'reload config'; notify pgrst, 'reload schema';`);
      // Reload is asynchronous. Retry only a read, never a mutation.
      for (let attempt = 0; attempt < 10; attempt++) {
        const probe = await database.schema("professional_service").from("organizations").select("id").limit(0);
        if (!probe.error) break;
        if (!["PGRST106", "PGRST205"].includes(probe.error.code) || attempt === 9) checked(probe, "Local API schema readiness");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    const publicClient = () => createClient(LOCAL_API, env.anonKey, options);
    const encryption = createEncryptionService(state.encryptionKey, 1);
    // No fixture cases or journals are created, and no journal dependency is called.
    const professional = new ProfessionalService(database, encryption, undefined as unknown as JournalService);
    const onboarding = new OnboardingService(database);
    const registration = new RegistrationService(database, publicClient, state.registrationSecret, "http://127.0.0.1:3000");
    const id = (name: Identity) => requireValue(state.accounts[name]?.id, `Missing ${name} identity.`);
    const table = (name: string) => database.schema("professional_service").from(name);
    const allUsers: User[] = checked(await database.auth.admin.listUsers({ page: 1, perPage: 1000 }), "Local account lookup").users;
    if (allUsers.length >= 1000) throw new Error("Unexpected account volume; fixture setup stopped.");
    for (const name of identities) {
      const existing = allUsers.find((user) => user.email === email(name));
      if (existing) {
        assertFixtureUser(existing, email(name));
        if (!state.accounts[name] || (state.accounts[name]?.id && state.accounts[name]?.id !== existing.id)) throw new Error("Fixture account does not match private manifest.");
        state.accounts[name]!.id = existing.id;
      } else if (state.accounts[name]?.id || action !== "setup") throw new Error(`Missing local fixture: ${name}.`);
    }
    if (action === "setup" && !state.complete) {
      await save();
      const policies = await registration.activePolicies();
      for (const name of identities) {
        state.accounts[name] ??= { password: randomBytes(30).toString("base64url") + "aA1!" };
        await save();
        const account = state.accounts[name]!;
        if (!account.id) {
          const eligibility = await registration.startEligibility("1990-01-01");
          const credentials = requireValue(eligibility.credentials, "Fictional adult eligibility failed.");
          const accepted = await registration.acceptAgreements(credentials.token, credentials.csrf, {
            reviewedDocumentIds: policies.map((p) => String(p.id)), termsAccepted: true, privacyAccepted: true,
            aiNoticeAccepted: true, optionalAiAnalysis: false,
          });
          const hash = (value: string) => createHmac("sha256", state.registrationSecret).update(value).digest("hex");
          const draftResult = checked(await database.rpc("echo_registration_get_draft", { draft_token_hash: hash(accepted.token) }), "Registration draft");
          const draft = Array.isArray(draftResult) ? draftResult[0] : draftResult;
          const reservation = randomUUID();
          const reserved = checked(await database.rpc("echo_registration_update_draft", {
            draft_id: draft.id, expected_token_hash: hash(accepted.token), expected_state: "account",
            changes: { email: email(name), reservation_id: reservation, state: "verification_pending", verification_sent_at: new Date().toISOString() },
          }), "Registration reservation");
          if (reserved !== true) throw new Error("Fixture registration reservation rejected.");
          // Supported Auth admin provisioning, with the real registration trigger and current policy records.
          const created = checked(await database.auth.admin.createUser({ email: email(name), password: account.password,
            email_confirm: true, user_metadata: { signup_reservation: reservation }, app_metadata: { fixture: FIXTURE_TAG } }), "Local Auth creation");
          account.id = requireValue(created.user?.id, "Local Auth returned no account.");
          await save();
        }
        if (!account.ready) {
          await onboarding.saveProfile(account.id, { preferredName: `Fictional ${name}`, timezone: "Asia/Taipei" });
          await onboarding.saveSetup(account.id, { genderIdentity: "prefer_not_to_say", pronouns: "use_my_name", notifications: false, facialAnalysis: false });
          await onboarding.completeOnboarding(account.id);
          account.ready = true; await save();
        }
      }
      await provisionVerificationAdmin(database, email("reviewer"), "grant");
      for (const suffix of ["a", "b"]) {
        const slug = `${FIXTURE_TAG}-${suffix}`;
        let org = checked(await table("organizations").select("id,status,created_by").eq("slug", slug).maybeSingle(), "Organization lookup");
        if (!org) {
          const created = await professional.createOrganization(id("reviewer"), { slug, name: `Fictional Echo Test Organization ${suffix.toUpperCase()}`,
            description: "LOCAL FICTIONAL FIXTURE. No clinical service or real credentials.", serviceHours: "Not a real service" });
          org = { id: created.organization.id, status: "pending", created_by: id("reviewer") };
        }
        if (org.created_by !== id("reviewer") || (state.organizations[suffix] && state.organizations[suffix] !== org.id)) throw new Error("Organization collision refused.");
        state.organizations[suffix] = org.id; await save();
        if (org.status === "pending") await professional.approveOrganization(id("reviewer"), org.id);
        else if (org.status !== "active") throw new Error("Organization state changed; refusing automatic reactivation.");
      }
      for (const name of ["approved-a", "approved-b", "pending", "suspended", "org-admin"] as const) {
        const organizationId = state.organizations[name === "approved-b" ? "b" : "a"];
        const member = checked(await table("memberships").select("id,status,role").eq("organization_id", organizationId).eq("user_id", id(name)).maybeSingle(), "Membership lookup");
        if (member) {
          // Resume interruption between initial activation and the intended suspension.
          if (name === "suspended" && member.status === "active") await professional.suspendMember(id("reviewer"), member.id);
          continue; // Never reactivate or renew an existing membership.
        }
        let credentialId: string | undefined;
        if (name !== "org-admin") {
          const rows = checked(await table("credential_reviews").select("id,status,credential_label,expires_at").eq("organization_id", organizationId).eq("user_id", id(name)), "Credential lookup") ?? [];
          if (rows.length > 1) throw new Error("Ambiguous fixture credentials; manual local review required.");
          let credential = rows[0];
          if (!credential) {
            const submitted = await professional.credentials.submit(id(name), { organizationId, role: "counselor", credentialLabel: label,
              expiresAt: state.expiresAt, evidenceReference: `FICTIONAL LOCAL TEST ONLY: ${name}; not a license, practitioner or clinical evidence.` });
            credential = { id: submitted.credential.id, status: "pending", credential_label: label, expires_at: state.expiresAt };
          }
          if (credential.credential_label !== label || credential.expires_at !== state.expiresAt) throw new Error("Credential fixture drift refused.");
          credentialId = credential.id;
          if (name !== "pending" && credential.status === "pending") {
            await professional.credentials.review(id("reviewer"), organizationId, credentialId!, { decision: "approved", reasonCode: null });
          }
        }
        if (name === "pending") {
          checked(await table("memberships").insert({ organization_id: organizationId, user_id: id(name), role: "counselor", status: "pending", display_name: `Fictional ${name}` }), "Pending application fixture");
        } else {
          const approved = await professional.approveMember(id("reviewer"), { organizationId, userId: id(name), role: name === "org-admin" ? "org_admin" : "counselor",
            displayName: `Fictional ${name}`, credentialLabel: name === "org-admin" ? null : label,
            credentialExpiresAt: name === "org-admin" ? null : state.expiresAt, credentialId });
          if (name === "suspended") await professional.suspendMember(id("reviewer"), approved.membershipId);
        }
      }
      state.complete = true; await save();
    }
    if (action === "cleanup") {
      // Non-destructive retirement: retain audit/credential history and never reset a database.
      for (const organizationId of Object.values(state.organizations)) {
        const org = checked(await table("organizations").select("status,created_by").eq("id", organizationId).single(), "Cleanup organization check");
        if (org.created_by !== id("reviewer")) throw new Error("Cleanup organization ownership mismatch.");
        const members = checked(await table("memberships").select("user_id").eq("organization_id", organizationId), "Cleanup membership check") ?? [];
        if (members.some((m) => !identities.some((name) => id(name) === m.user_id))) throw new Error("Nonfixture member found; cleanup refused.");
        const requests = checked(await table("support_requests").select("id").eq("organization_id", organizationId).limit(1), "Cleanup usage check");
        if (requests?.length) throw new Error("Fixture organization has case data; review cleanup manually.");
      }
      for (const organizationId of Object.values(state.organizations)) {
        const org = checked(await table("organizations").select("status").eq("id", organizationId).single(), "Cleanup state");
        if (org.status === "active") await professional.suspendOrganization(id("reviewer"), organizationId);
      }
      for (const name of identities) {
        checked(await database.auth.admin.updateUserById(id(name), { ban_duration: "876000h" }), "Retire fixture login");
        checked(await database.schema("user_service").from("profiles").update({ account_status: "suspended" }).eq("user_id", id(name)), "Retire fixture profile");
      }
      await provisionVerificationAdmin(database, email("reviewer"), "revoke");
      state.retired = true; await save();
      process.stdout.write("Local fixture accounts banned, profiles restricted, organizations suspended, reviewer revoked. History retained.\n"); return;
    }
    if (action === "inspect") {
      process.stdout.write(JSON.stringify({ fixture: state.tag, accounts: identities.map((name) => ({ identity: name, email: email(name), id: id(name) })), organizations: state.organizations,
        expiresAt: state.expiresAt, retired: Boolean(state.retired), mfaEnabled: env.mfaEnabled, mailpit: "http://127.0.0.1:54324" }, null, 2) + "\n"); return;
    }
    if (state.retired) throw new Error("Fixtures are retired; no access checks run.");
    let checks = 0;
    const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); checks++; };
    for (const name of identities) {
      const user = checked(await database.auth.admin.getUserById(id(name)), "Verify identity").user;
      assertFixtureUser(user, email(name)); assert(Boolean(user.email_confirmed_at), "Fixture email is unconfirmed.");
      const profile = checked(await database.schema("user_service").from("profiles").select("eligible_18_plus,onboarding_completed,account_status").eq("user_id", id(name)).single(), "Verify profile");
      assert(profile.eligible_18_plus && profile.onboarding_completed && profile.account_status === "active", "Fixture profile is not eligible.");
    }
    for (const [name, status] of [["approved-a", "active"], ["approved-b", "active"], ["pending", "pending"], ["suspended", "suspended"], ["org-admin", "active"]] as const) {
      const memberships = (await professional.memberships(id(name))).memberships;
      assert(memberships.length === 1 && memberships[0].status === status && memberships[0].organizationId === state.organizations[name === "approved-b" ? "b" : "a"], `Unexpected ${name} membership.`);
    }
    assert((await professional.memberships(id("client"))).memberships.length === 0, "Client unexpectedly has membership.");
    for (const [name, suffix] of [["approved-a", "a"], ["approved-b", "b"], ["org-admin", "a"]] as const) {
      const result = await professional.dashboard(id(name), state.organizations[suffix]);
      assert(Boolean(result), "Authorized scoped dashboard failed.");
    }
    for (const [name, suffix] of [["approved-a", "b"], ["approved-b", "a"], ["pending", "a"], ["suspended", "a"], ["client", "a"], ["org-admin", "b"]] as const) {
      const result = await database.schema("professional_service").rpc("dashboard_overview", { p_actor: id(name), p_organization_id: state.organizations[suffix] });
      assert(result.error?.message === "MEMBERSHIP_REQUIRED" && result.data === null, `Database isolation failed for ${name}.`);
      let denied = false;
      try { await professional.dashboard(id(name), state.organizations[suffix]); }
      catch (error) { denied = (error as { statusCode?: number }).statusCode === 403; }
      assert(denied, `Service isolation failed for ${name}.`);
    }
    const pending = checked(await table("credential_reviews").select("id,status").eq("user_id", id("pending")).single(), "Verify pending credential");
    assert(pending.status === "pending", "Pending evidence was unexpectedly approved.");
    const forged = await database.schema("professional_service").rpc("review_credential", { p_actor: id("org-admin"), p_organization_id: state.organizations.a, p_credential_id: pending.id, p_decision: "approved", p_reason_code: null });
    assert(forged.error?.message === "CREDENTIAL_FORBIDDEN", "Organization admin unexpectedly has review authority.");
    // Real PostgreSQL self-review denial; all temporary evidence/audits roll back.
    const ciphertext = encryptText("FICTIONAL self-review denial fixture only", encryption);
    localSql(`begin; set local role service_role; set local request.jwt.claim.role='service_role';
      do $$ declare credential uuid; begin
        select id into credential from professional_service.submit_credential(
          '${state.organizations.a}'::uuid,'${id("reviewer")}'::uuid,'counselor','Fictional denial check',current_date+1,'${ciphertext}');
        begin
          perform professional_service.review_credential('${state.organizations.a}'::uuid,credential,'${id("reviewer")}'::uuid,'approved',null);
          raise exception 'SELF_REVIEW_TEST_FAILED';
        exception when others then if sqlerrm <> 'CREDENTIAL_SELF_REVIEW' then raise; end if; end;
      end $$; rollback;`);
    checks++;
    for (const name of ["approved-a", "approved-b", "suspended"] as const) {
      const row = checked(await table("credential_reviews").select("status,reviewed_by,evidence_reference_encrypted").eq("user_id", id(name)).single(), "Verify reviewed credential");
      assert(row.status === "approved" && row.reviewed_by === id("reviewer") && row.reviewed_by !== id(name) && row.evidence_reference_encrypted.startsWith("echo:encrypted:v1:"), "Credential independence/encryption failed.");
    }
    const login = publicClient();
    const signedIn = checked(await login.auth.signInWithPassword({ email: email("approved-a"), password: state.accounts["approved-a"]!.password }), "Local password login");
    try {
      const actor = await createSupabaseAccessTokenVerifier(database, LOCAL_API).getUser(requireValue(signedIn.session?.access_token, "Missing real session."));
      assert(actor?.id === id("approved-a") && actor.assuranceLevel === "aal1", "Local session could not be verified at AAL1.");
      let denial: unknown;
      requireMfa({ auth: actor } as unknown as Request, {} as Response, (error?: unknown) => { denial = error; });
      assert((denial as { code?: string })?.code === "MFA_REQUIRED", "MFA gate did not deny AAL1.");
      const browser = await login.schema("professional_service").from("memberships").select("id");
      assert(browser.error?.code === "42501" && browser.data === null, "Browser private-table permission denial was not confirmed.");
    } finally { await login.auth.signOut({ scope: "local" }); }
    const mail = await fetch("http://127.0.0.1:54324/api/v1/info", { redirect: "error", signal: AbortSignal.timeout(10_000) });
    assert(mail.ok, "Mailpit is unavailable.");
    process.stdout.write(`PASS: ${checks} focused local fixture checks; seven identities, two organizations.\n`);
    process.stdout.write(`MFA enrollment/verification: ${env.mfaEnabled ? "enabled (AAL2 not tested)" : "BLOCKED: local TOTP disabled; AAL1 correctly denied"}. No browser or Postman journeys run.\n`);
  } finally { await lock.close(); await unlink(lockPath); }
}
main().catch((error: unknown) => {
  // Do not serialize SDK errors, HTTP bodies, secrets, tokens or command output.
  process.stderr.write((error instanceof Error ? error.message : "Local fixture setup failed.") + "\n");
  process.exitCode = 1;
});
