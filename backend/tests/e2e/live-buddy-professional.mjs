import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadQaTarget, verifyQaUserRemoved } from "./qa-target.mjs";

const qaTarget = loadQaTarget();
const environment = qaTarget.environment;
const projectRef = new URL(environment.SUPABASE_URL).hostname.split(".")[0];
if (!qaTarget.staging && (process.env.ECHO_LIVE_SUPPORT_QA !== "1" || process.env.ECHO_LIVE_SUPPORT_QA_PROJECT !== projectRef)) {
  throw new Error("Set ECHO_LIVE_SUPPORT_QA=1 and ECHO_LIVE_SUPPORT_QA_PROJECT to the linked project ref before running disposable support QA.");
}
const apiBase = qaTarget.staging ? qaTarget.apiBase : (process.env.ECHO_API_BASE_URL ?? `http://127.0.0.1:${environment.PORT || "4200"}/api/v1`);
const webBase = qaTarget.staging ? qaTarget.webBase : (process.env.ECHO_WEB_BASE_URL ?? "http://localhost:3000");
const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
const accounts = [];
const suffix = randomUUID().slice(0, 8);
let organizationId;
let requestId;

function checked(result, label) {
  if (result.error) throw new Error(`${label} failed (${result.error.code ?? "unknown"}).`);
  return result.data;
}

async function token(account) {
  const session = checked(await account.client.auth.getSession(), "Read QA session").session;
  if (!session?.access_token) throw new Error("The QA session expired.");
  return session.access_token;
}

async function request(route, account, method = "GET", body, expectedStatus = 200) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${await token(account)}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${route} returned ${response.status}, expected ${expectedStatus} (${result?.error?.code ?? "no code"}).`);
  }
  return expectedStatus >= 400 ? result?.error : result?.data;
}

async function createAccount(role) {
  const email = `echo-support-qa-${role}-${suffix}@example.invalid`;
  const password = `Echo-QA-${randomBytes(24).toString("base64url")}!`;
  const created = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `Create ${role} account`);
  assert.ok(created.user?.id, `${role} account has an ID`);
  const account = { id: created.user.id, email, password, client: createClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, clientOptions) };
  accounts.push(account);
  checked(await admin.schema("user_service").from("profiles").upsert({
    user_id: account.id, display_name: `ECHO ${role} QA`, account_status: "active",
  }, { onConflict: "user_id" }), `Create ${role} profile`);
  checked(await account.client.auth.signInWithPassword({ email, password }), `Sign in ${role}`);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(`${apiBase}/access/status`, { headers: { Authorization: `Bearer ${await token(account)}` } });
    if (response.ok) return account;
    if (response.status !== 401) throw new Error(`${role} access check returned ${response.status}.`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${role} account was not accepted by the backend.`);
}

async function onboard(account) {
  await request("/access/age", account, "POST", { birthday: "1990-01-01" });
  await request("/onboarding/consent", account, "POST", {
    terms: true, privacy: true, dataProcessing: true, aiInformation: true, journalAnalysis: false,
  });
  await request("/onboarding/profile", account, "POST", { preferredName: "ECHO QA", timezone: "Asia/Manila" });
  await request("/onboarding/setup", account, "POST", { notifications: false });
  await request("/onboarding/complete", account, "POST");
  const policies = checked(await admin.schema("auth_provisioning").from("policy_documents")
    .select("id").eq("is_active", true), "Read active policies");
  await request("/access/policies", account, "POST", { reviewedDocumentIds: policies.map((item) => item.id) });
  assert.equal((await request("/access/status", account)).decision, "ACCESS_GRANTED");
}

// Synthetic approval sets only the gate state; it does not claim that a real ID was reviewed.
async function enableBuddyForFixture(account) {
  const now = new Date();
  checked(await admin.schema("verification_service").from("identity_verifications").insert({
    user_id: account.id, verification_status: "approved", reviewed_at: now.toISOString(),
    approved_expires_at: new Date(now.getTime() + 86_400_000).toISOString(),
  }), "Seed QA-only Buddy approval");
  assert.equal((await request("/verification", account)).accessRequirement, "trusted_contact");
  await request("/settings/trusted-contacts", account, "POST", {
    contactName: "Synthetic QA contact", contactEmail: `qa-contact-${suffix}@example.invalid`,
    contactPhone: null, relationship: "QA fixture", isPrimary: true, permissionAcknowledged: true,
  }, 201);
  assert.equal((await request("/verification", account)).canAccessAi, true);
}

function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0; let value = 0; const bytes = [];
  for (const letter of secret.toUpperCase().replace(/=|\s/g, "")) {
    value = (value << 5) | alphabet.indexOf(letter);
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function enrollMfa(account) {
  const factor = checked(await account.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Disposable support QA" }), "Enroll QA MFA");
  assert.ok(factor.id && factor.totp?.secret, "Supabase returned a QA TOTP factor");
  checked(await account.client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) }), "Verify QA MFA");
  const claims = JSON.parse(Buffer.from((await token(account)).split(".")[1], "base64url").toString("utf8"));
  assert.equal(claims.aal, "aal2", "Practitioner session has real Supabase MFA assurance");
}

async function buddyJourney(owner, practitioner) {
  assert.equal((await request("/buddy/session", owner, "GET", undefined, 403)).code, "VERIFICATION_REQUIRED");
  await enableBuddyForFixture(owner);
  const older = await request("/buddy/conversations", owner, "POST", {}, 201);
  const newer = await request("/buddy/conversations", owner, "POST", {}, 201);
  assert.notEqual(older.id, newer.id, "New Buddy chat has a separate ID");
  const first = `Synthetic check-in ${suffix} feels busy today`;
  const followup = `Synthetic follow-up ${suffix} is still here`;
  await request("/buddy/messages", owner, "POST", { conversationId: older.id, content: first }, 201);
  await request("/buddy/messages", owner, "POST", { conversationId: older.id, content: followup }, 201);
  const reopened = await request(`/buddy/conversations/${older.id}`, owner);
  assert.equal(reopened.messages.filter((item) => item.role === "user").length, 2);
  assert.ok(reopened.messages.some((item) => item.content === first));
  assert.ok(reopened.messages.some((item) => item.content === followup));
  assert.equal((await request(`/buddy/conversations/${newer.id}`, owner)).messages.filter((item) => item.role === "user").length, 0);
  const history = await request("/buddy/history?page=1&pageSize=20", owner);
  assert.ok(history.conversations.some((item) => item.id === older.id && item.preview));
  assert.ok((await request(`/buddy/history?page=1&pageSize=20&query=${encodeURIComponent(suffix)}`, owner)).conversations.some((item) => item.id === older.id));
  await request(`/buddy/conversations/${older.id}/pin`, owner, "PUT", { pinned: true });
  assert.equal((await request("/buddy/history?page=1&pageSize=20", owner)).conversations[0].id, older.id);
  const privacy = (await request("/settings", owner)).privacy;
  const privacyInput = {
    journalAiAnalysisEnabled: privacy.journalAiAnalysisEnabled, facialAnalysisEnabled: privacy.facialAnalysisEnabled,
    crisisSupportVisible: privacy.crisisSupportVisible, lockScreenPrivate: privacy.lockScreenPrivate,
  };
  await request("/settings/privacy", owner, "PATCH", { ...privacyInput, buddyHistoryEnabled: false });
  assert.equal((await request("/buddy/messages", owner, "POST", { content: "Temporary synthetic chat" }, 201)).persisted, false);
  assert.equal((await request("/buddy/messages", owner, "POST", { conversationId: older.id, content: "Not saved" }, 409)).code, "BUDDY_HISTORY_DISABLED");
  await request("/settings/privacy", owner, "PATCH", { ...privacyInput, buddyHistoryEnabled: true });
  assert.equal((await request(`/buddy/conversations/${older.id}`, owner)).messages.filter((item) => item.role === "user").length, 2);
  await enableBuddyForFixture(practitioner);
  assert.equal((await request(`/buddy/conversations/${older.id}`, practitioner, "GET", undefined, 404)).code, "NOT_FOUND");
  return { olderId: older.id, first, followup };
}

async function professionalJourney(owner, practitioner, outsider) {
  const now = new Date();
  const created = checked(await admin.schema("professional_service").from("organizations").insert({
    slug: `echo-qa-${suffix}`, name: `ECHO QA only ${suffix} — not a real provider`,
    description: "Disposable automated test organization. Do not use for care.",
    status: "active", accepting_requests: true, verified_at: now.toISOString(),
    verified_by: practitioner.id, created_by: practitioner.id,
  }).select("id").single(), "Create QA organization");
  organizationId = created.id;
  const member = checked(await admin.schema("professional_service").from("memberships").insert({
    organization_id: organizationId, user_id: practitioner.id, role: "counselor", status: "active",
    display_name: "Synthetic QA practitioner", credential_label: "Synthetic QA credential — not a license",
    credential_expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10),
    approved_at: now.toISOString(), approved_by: practitioner.id,
  }).select("id").single(), "Create QA practitioner membership");
  // Keep the synthetic profile out of public practitioner discovery.
  checked(await admin.schema("professional_service").from("practitioner_profiles")
    .update({ discoverable: false, accepting_requests: false }).eq("membership_id", member.id), "Hide QA practitioner");
  assert.equal((await request("/professional/me", practitioner)).mfaRequired, true);
  assert.equal((await request(`/professional/organizations/${organizationId}/queue`, practitioner, "GET", undefined, 403)).code, "MFA_REQUIRED");
  const createdRequest = await request("/professional/my-requests", owner, "POST", {
    submissionId: randomUUID(), organizationId, preferredProfileId: null,
    summary: "Synthetic support request for an automated two-account QA journey.",
    preferredTime: "Tomorrow afternoon", journalIds: [], phq8Ids: [], consent: true,
  }, 201);
  requestId = createdRequest.request.id;
  assert.equal((await request(`/professional/my-requests/${requestId}`, outsider, "GET", undefined, 403)).code, "RESOURCE_FORBIDDEN");
  await enrollMfa(practitioner);
  assert.equal((await request("/professional/me", practitioner)).mfaRequired, false);
  assert.ok((await request(`/professional/organizations/${organizationId}/queue`, practitioner)).requests.some((item) => item.id === requestId));
  assert.equal((await request(`/professional/cases/${requestId}/claim`, practitioner, "POST", {})).request.assignedTo, practitioner.id);
  const professionalMessage = `Synthetic practitioner message ${suffix}`;
  const userMessage = `Synthetic user reply ${suffix}`;
  await request(`/professional/cases/${requestId}/messages`, practitioner, "POST", { clientMessageId: randomUUID(), body: professionalMessage }, 201);
  assert.ok((await request(`/professional/my-requests/${requestId}/messages`, owner)).messages.some((item) => item.body === professionalMessage));
  await request(`/professional/my-requests/${requestId}/messages`, owner, "POST", { clientMessageId: randomUUID(), body: userMessage }, 201);
  assert.ok((await request(`/professional/cases/${requestId}/messages`, practitioner)).messages.some((item) => item.body === userMessage));
  const startsAt = new Date(Date.now() + 2 * 86_400_000);
  startsAt.setUTCHours(8, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
  const proposed = await request(`/professional/cases/${requestId}/appointments`, practitioner, "POST", {
    startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), mode: "online",
    locationHint: `QA only ${suffix}`,
  }, 201);
  const appointmentId = proposed.appointmentId;
  assert.ok((await request("/notifications", owner)).notifications.some((item) =>
    item.type === "professional_appointment_proposed" && item.resourceType === "professional_case" && item.resourceId === requestId));
  assert.ok((await request("/professional/appointments", owner)).appointments.some((item) => item.id === appointmentId && item.status === "proposed"));
  assert.equal((await request(`/professional/appointments/${appointmentId}/respond`, owner, "POST", { accept: true })).status, "confirmed");
  assert.ok((await request("/professional/appointments", owner)).appointments.some((item) => item.id === appointmentId && item.status === "confirmed"));
  assert.equal((await request(`/professional/appointments/${appointmentId}/respond`, outsider, "POST", { accept: true }, 403)).code, "RESOURCE_FORBIDDEN");
  assert.ok((await request(`/professional/my-requests/${requestId}/timeline`, owner)).events.some((item) => item.type === "appointment_confirmed"));
  return { appointmentId, startsAt: startsAt.toISOString(), professionalMessage };
}

async function browserJourney(owner, practitioner, buddy, appointment) {
  const { webkit, devices } = await import("playwright");
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext(devices["iPhone 13"]);
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto(`${webBase}/login`);
    await page.getByRole("button", { name: "Use password instead" }).click();
    await page.getByRole("textbox", { name: "Email address" }).fill(owner.email);
    await page.locator("#auth-password").fill(owner.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/dashboard");
    await page.goto(`${webBase}/buddy?conversation=${buddy.olderId}`);
    const messages = page.getByLabel("Conversation messages");
    await messages.getByText(buddy.first).waitFor();
    await messages.getByText(buddy.followup).waitFor();
    const browserFollowup = `Synthetic browser follow-up ${suffix}`;
    await page.getByRole("textbox", { name: "Message Buddy" }).fill(browserFollowup);
    await page.getByRole("button", { name: "Send message" }).click();
    await messages.getByText(browserFollowup).waitFor();
    await page.reload();
    await messages.getByText(browserFollowup).waitFor();
    assert.equal(await messages.getByText(browserFollowup).count(), 1, "Buddy follow-up appears once after reload");
    await page.goto(`${webBase}/calendar`);
    await page.getByRole("heading", { name: "A place for each day" }).waitFor();
    const target = await page.evaluate((iso) => {
      const date = new Date(iso);
      return {
        label: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date),
        month: date.getMonth(), year: date.getFullYear(),
      };
    }, appointment.startsAt);
    const current = await page.evaluate(() => ({ month: new Date().getMonth(), year: new Date().getFullYear() }));
    const offset = (target.year - current.year) * 12 + target.month - current.month;
    for (let index = 0; index < Math.abs(offset); index += 1) {
      await page.getByRole("button", { name: offset > 0 ? "Next month" : "Previous month" }).click();
    }
    await page.getByRole("button", { name: new RegExp(`^${target.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: .*1 appointments`) }).click();
    const day = page.locator('aside[aria-label="Selected day details"]');
    await day.getByText(`QA only ${suffix}`).waitFor();
    await day.getByText("confirmed", { exact: true }).waitFor();
    const screenshot = path.resolve(process.cwd(), "../artifacts/qa/buddy-professional-calendar-mobile.png");
    mkdirSync(path.dirname(screenshot), { recursive: true });
    await day.scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshot });
    assert.equal((await request(`/professional/appointments/${appointment.appointmentId}/complete`, practitioner, "POST", {}, 409)).code, "APPOINTMENT_NOT_STARTED");
    // Advance only this disposable appointment to represent a session that has happened.
    const endedAt = new Date(Date.now() - 15 * 60_000);
    checked(await admin.schema("professional_service").from("appointments")
      .update({ starts_at: new Date(endedAt.getTime() - 45 * 60_000).toISOString(), ends_at: endedAt.toISOString() })
      .eq("id", appointment.appointmentId).eq("request_id", requestId).select("id").single(), "Advance QA appointment time");
    assert.equal((await request(`/professional/appointments/${appointment.appointmentId}/complete`, practitioner, "POST", {})).status, "completed");
    assert.equal((await request(`/professional/cases/${requestId}/close`, practitioner, "POST", {})).request.status, "closed");
    assert.ok((await request("/professional/my-requests", owner)).requests.some((item) => item.id === requestId && item.status === "closed"));
    assert.ok((await request(`/professional/my-requests/${requestId}/timeline`, owner)).events.some((item) => item.type === "case_closed"));
    await page.goto(`${webBase}/professional-support/history`);
    const history = page.getByLabel("Selected case history");
    await history.getByText("Synthetic support request for an automated two-account QA journey.").waitFor();
    await history.getByText("Appointment completed", { exact: true }).waitFor();
    const historyScreenshot = path.resolve(process.cwd(), "../artifacts/qa/professional-support-history-mobile.png");
    await history.scrollIntoViewIfNeeded();
    await page.screenshot({ path: historyScreenshot });
    await context.close();
    return { calendar: screenshot, history: historyScreenshot };
  } finally {
    await browser.close();
  }
}

async function cleanup() {
  const failures = [];
  const remove = async (label, operation) => {
    try { checked(await operation(), label); } catch (error) { failures.push(error.message); }
  };
  if (organizationId) {
    // The service role intentionally has no DELETE grant on professional records.
    // Use the linked project's CLI SQL connection only for this guarded QA fixture.
    if (!/^[0-9a-f-]{36}$/.test(organizationId) || !/^[0-9a-f]{8}$/.test(suffix)) {
      failures.push("QA fixture identifiers were invalid; professional cleanup was not attempted.");
    } else {
      const sqlPath = path.join(os.tmpdir(), `echo-support-qa-cleanup-${suffix}.sql`);
      const sql = `begin;
do $$ begin
  if not exists (select 1 from professional_service.organizations where id = '${organizationId}' and slug = 'echo-qa-${suffix}') then
    raise exception 'QA organization identity mismatch';
  end if;
end $$;
delete from professional_service.audit_events where organization_id = '${organizationId}';
delete from professional_service.support_requests where organization_id = '${organizationId}';
delete from professional_service.memberships where organization_id = '${organizationId}';
delete from professional_service.organizations where id = '${organizationId}' and slug = 'echo-qa-${suffix}';
commit;`;
      try {
        writeFileSync(sqlPath, sql, { flag: "wx", mode: 0o600 });
        const target = qaTarget.staging ? ["--project-ref", qaTarget.projectRef] : ["--linked"];
        const command = spawnSync("cmd.exe", ["/d", "/s", "/c", "supabase.cmd", "db", "query", ...target, "--file", sqlPath], {
          cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", timeout: 60_000,
        });
        if (command.status !== 0) failures.push(`Delete QA organization via linked SQL failed: ${command.stdout || command.stderr || command.error?.message}`);
      } catch (error) {
        failures.push(`Delete QA organization via linked SQL failed: ${error.message}`);
      } finally {
        try { unlinkSync(sqlPath); } catch { /* The query may fail before the file is created. */ }
      }
    }
  }
  for (const account of accounts.reverse()) {
    await remove("Delete QA Buddy approval", () => admin.schema("verification_service").from("identity_verifications").delete().eq("user_id", account.id));
    await remove("Delete QA account", () => admin.auth.admin.deleteUser(account.id));
    if (qaTarget.staging) {
      try { await verifyQaUserRemoved(admin, account.id); }
      catch (error) { failures.push(error.message); }
    }
  }
  if (failures.length) throw new Error(`QA cleanup needs attention for organization ${organizationId ?? "none"} and accounts ${accounts.map((account) => account.id).join(", ")}: ${failures.join("; ")}`);
  if (organizationId) {
    const remaining = await admin.schema("professional_service").from("organizations")
      .select("id", { count: "exact", head: true }).eq("id", organizationId);
    checked(remaining, "Verify QA organization cleanup");
    assert.equal(remaining.count, 0, "QA organization was removed");
  }
  console.info("Disposable QA organization and accounts removed.");
}

let outcome;
let journeyFailure;
let cleanupFailure;
try {
  const owner = await createAccount("user");
  const practitioner = await createAccount("practitioner");
  const outsider = await createAccount("outsider");
  await onboard(owner);
  await onboard(practitioner);
  const buddy = await buddyJourney(owner, practitioner);
  const appointment = await professionalJourney(owner, practitioner, outsider);
  outcome = await browserJourney(owner, practitioner, buddy, appointment);
} catch (error) {
  journeyFailure = error;
} finally {
  try {
    await cleanup();
  } catch (error) {
    cleanupFailure = error;
  }
}
if (journeyFailure && cleanupFailure) throw new AggregateError([journeyFailure, cleanupFailure], "Support QA and fixture cleanup both failed");
if (cleanupFailure) throw cleanupFailure;
if (journeyFailure) throw journeyFailure;
console.info(`PASS: gated Buddy continuation, real MFA practitioner messaging and appointment, mobile Calendar, closed support history. Screenshots: ${outcome.calendar}; ${outcome.history}`);
