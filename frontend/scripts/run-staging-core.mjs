import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadQaTarget, verifyQaUserRemoved } from "../../backend/tests/e2e/qa-target.mjs";

if (!process.env.ECHO_QA_ENV_FILE) throw new Error("Set ECHO_QA_ENV_FILE to a server-only staging environment file.");
const target = loadQaTarget();
assert.equal(target.staging, true);
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = randomUUID().slice(0, 8);
const stateDirectory = path.join(frontendRoot, ".qa-staging", runId);
const createdFiles = [];
const accounts = [];
let journalId;
let calendarItemId;
let member;
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(target.environment.SUPABASE_URL, target.environment.SUPABASE_SERVICE_ROLE_KEY, options);

function checked(result, action) {
  if (result.error) throw new Error(`${action} failed (${result.error.code ?? "unknown"}).`);
  return result.data;
}

async function api(account, route, method = "GET", body, expected = 200, headers = {}) {
  const response = await fetch(`${target.apiBase}${route}`, {
    method,
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${account.token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => null);
  if (response.status !== expected) {
    throw new Error(`${method} ${route} returned ${response.status}, expected ${expected} (${result?.error?.code ?? "no code"}).`);
  }
  return result?.data;
}

async function createAccount(name) {
  const email = `echo-qa-${name}-${runId}@example.invalid`;
  const password = `Echo-QA-${randomBytes(20).toString("base64url")}!`;
  const created = checked(await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: {
      display_name: `ECHO ${name} QA`,
      signup_consent: {
        version: "2026-07-25", terms_accepted: true, privacy_acknowledged: true,
        data_processing_acknowledged: true, ai_feature_acknowledged: true,
        journal_analysis_consent: false,
      },
    },
  }), `Create ${name} account`);
  assert.ok(created.user?.id);
  const account = { id: created.user.id, name, email, password };
  accounts.push(account);
  checked(await admin.schema("user_service").from("profiles").upsert({
    user_id: account.id, display_name: `ECHO ${name} QA`, account_status: "active",
  }, { onConflict: "user_id" }), `Create ${name} profile`);
  const client = createClient(target.environment.SUPABASE_URL, target.environment.SUPABASE_PUBLISHABLE_KEY, options);
  const signedIn = checked(await client.auth.signInWithPassword({ email, password }), `Sign in ${name}`);
  assert.ok(signedIn.session?.access_token);
  account.token = signedIn.session.access_token;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(`${target.apiBase}/access/status`, {
      headers: { Authorization: `Bearer ${account.token}` }, signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return account;
    if (response.status !== 401) throw new Error(`${name} access check returned ${response.status}.`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${name} account was not accepted by the staging API.`);
}

async function advanceOnboarding(account, stage) {
  if (stage === "new-user") return;
  await api(account, "/access/age", "POST", { birthday: "1990-01-01" });
  if (stage === "policies-user") return;
  const policies = checked(await admin.schema("auth_provisioning").from("policy_documents")
    .select("id").eq("is_active", true), "Read staging policies");
  assert.ok(policies.length > 0);
  await api(account, "/access/policies", "POST", { reviewedDocumentIds: policies.map((item) => item.id) });
  if (stage === "consent-user") return;
  await api(account, "/onboarding/consent", "POST", {
    terms: true, privacy: true, dataProcessing: true, aiInformation: true, journalAnalysis: false,
  });
  if (stage === "profile-user") return;
  await api(account, "/onboarding/profile", "POST", { preferredName: "ECHO QA", timezone: "Asia/Manila" });
  if (stage === "setup-user") return;
  await api(account, "/onboarding/setup", "POST", { notifications: false });
  await api(account, "/onboarding/complete", "POST");
  assert.equal((await api(account, "/access/status")).decision, "ACCESS_GRANTED");
}

function track(file) { createdFiles.push(file); return file; }

async function saveBrowserState(browser, account) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${target.webBase}/login`);
    await page.getByRole("button", { name: "Use password instead" }).click();
    await page.getByRole("textbox", { name: "Email address" }).fill(account.email);
    await page.locator("#auth-password").fill(account.password);
    await page.getByLabel("Remember me on this device").check();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 45_000 });
    const file = track(path.join(stateDirectory, `${account.name}.json`));
    await context.storageState({ path: file });
    if (account.name === "member") {
      const fresh = await browser.newContext({ storageState: file });
      try {
        const freshPage = await fresh.newPage();
        await freshPage.goto(`${target.webBase}/dashboard`);
        assert.equal(new URL(freshPage.url()).pathname, "/dashboard", "Saved member session survives a new browser context");
      } finally { await fresh.close(); }
    }
  } finally { await context.close(); }
}

async function createMemberData() {
  const journal = await api(member, "/journals", "POST", {
    title: `Synthetic staging reflection ${runId}`,
    body: "A disposable journal entry for route and ownership QA.",
    mood: "calm", emotions: [], tags: ["qa"], privacyStatus: "private", analysisConsent: false,
  }, 201, { "Idempotency-Key": randomUUID() });
  journalId = journal?.journalId;
  assert.ok(journalId);
  const date = new Date().toISOString().slice(0, 10);
  const item = await api(member, "/calendar/items", "POST", {
    scheduledOn: date, scheduledTime: "09:30", kind: "reminder", content: "Synthetic staging reminder",
  }, 201);
  calendarItemId = item?.id;
  assert.ok(calendarItemId);
  const outsider = accounts.find((account) => account.name === "unrelated");
  const denied = await fetch(`${target.apiBase}/journals/${journalId}`, {
    headers: { Authorization: `Bearer ${outsider.token}` }, signal: AbortSignal.timeout(20_000),
  });
  assert.equal(denied.status, 404, "Other account cannot read member journal");
  const listed = await api(member, "/journals");
  assert.ok(listed.entries?.some((entry) => entry.id === journalId));
}

async function cleanup() {
  const failures = [];
  const attempt = async (label, operation) => { try { await operation(); } catch (error) { failures.push(`${label}: ${error.message}`); } };
  if (member) await attempt("Journal draft and photos", async () => {
    const images = await api(member, "/journals/draft/images");
    for (const image of images ?? []) await api(member, `/journals/draft/images/${image.id}`, "DELETE", undefined, 204);
    await api(member, "/journals/draft", "DELETE", undefined, 204);
  });
  if (calendarItemId && member) await attempt("Calendar item", async () => {
    await api(member, `/calendar/items/${calendarItemId}`, "DELETE");
    const remaining = await admin.schema("user_service").from("calendar_items")
      .select("id", { count: "exact", head: true }).eq("id", calendarItemId);
    checked(remaining, "Verify calendar cleanup");
    assert.equal(remaining.count, 0, "Synthetic calendar item remains");
  });
  if (journalId && member) await attempt("Journal", async () => {
    await api(member, `/journals/${journalId}`, "DELETE", undefined, 204);
  });
  for (const account of [...accounts].reverse()) await attempt(`${account.name} account`, async () => {
    checked(await admin.auth.admin.deleteUser(account.id), `Delete ${account.name}`);
    await verifyQaUserRemoved(admin, account.id);
  });
  for (const file of createdFiles) if (existsSync(file)) await attempt("Browser fixture file", async () => unlinkSync(file));
  if (existsSync(stateDirectory)) await attempt("Browser fixture directory", async () => rmdirSync(stateDirectory));
  if (failures.length) throw new Error(`Staging cleanup needs attention for run ${runId}: ${failures.join("; ")}`);
  console.info(`Staging run ${runId}: disposable accounts, journal, calendar item, and browser states removed.`);
}

let testFailure;
try {
  mkdirSync(stateDirectory, { recursive: true });
  for (const stage of ["new-user", "consent-user", "profile-user", "setup-user", "policies-user", "member", "unrelated"]) {
    const account = await createAccount(stage);
    await advanceOnboarding(account, stage === "unrelated" ? "member" : stage);
    if (stage === "member") member = account;
  }
  await createMemberData();
  const browser = await chromium.launch();
  try {
    for (const account of accounts) await saveBrowserState(browser, account);
  } finally { await browser.close(); }
  for (const alias of ["journal", "calendar", "insights"]) {
    const file = track(path.join(stateDirectory, `${alias}.json`));
    copyFileSync(path.join(stateDirectory, "member.json"), file);
  }
  const idsFile = track(path.join(stateDirectory, "route-ids.json"));
  writeFileSync(idsFile, JSON.stringify({ journalId }));
  const command = spawnSync(process.execPath, [path.resolve(frontendRoot, "../node_modules/@playwright/test/cli.js"),
    "test", "--config=playwright.staging.config.ts"], {
    cwd: frontendRoot, stdio: "inherit", timeout: 45 * 60_000, env: {
      ...process.env,
      ECHO_STAGING_SUPABASE_URL: target.environment.SUPABASE_URL,
      ECHO_STAGING_AUTH_STATE_DIR: stateDirectory,
      ECHO_STAGING_ROUTE_IDS_FILE: idsFile,
      ECHO_STAGING_TIER: "core",
    },
  });
  if (command.error || command.status !== 0) throw command.error ?? new Error(`Core browser QA exited ${command.status}.`);
} catch (error) {
  testFailure = error;
} finally {
  try { await cleanup(); } catch (error) {
    if (testFailure) throw new AggregateError([testFailure, error], "Staging QA and fixture cleanup both failed");
    throw error;
  }
}
if (testFailure) throw testFailure;
