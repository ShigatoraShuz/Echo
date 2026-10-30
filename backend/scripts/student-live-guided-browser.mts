/** Explicit Guided Support with the owned FastAPI stopped. Local fictional actors only. */
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { localEnvironment, localFetch, LOCAL_API, assertFixtureUser } from "./lib/professional-local-target.mts";
import { consultationOrigin } from "./lib/consultation-origin.mts";

const target = localEnvironment(process.cwd());
const state = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (state.fingerprint !== target.fingerprint || state.tag !== "echo-student-consultation-v1") throw new Error("Fixture mismatch");
const account = state.accounts[0], options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } };
const auth = createClient(LOCAL_API, target.anonKey, options), db = createClient(LOCAL_API, target.serviceKey, options);
const login = await auth.auth.signInWithPassword({ email: account.email, password: account.password });
if (login.error || !login.data.session) throw new Error("Fixture login failed");
assertFixtureUser(login.data.user!, account.email);
if (login.data.user!.id !== account.id || login.data.user!.app_metadata.consultation_demo !== true) throw new Error("Actor mismatch");
expect(await fetch("http://127.0.0.1:8100/openapi.json", { signal: AbortSignal.timeout(1000) }).then(() => true).catch(() => false)).toBe(false);
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`http://127.0.0.1:4300/api/v1${path}`, { method, redirect: "error", headers: { Authorization: `Bearer ${login.data.session!.access_token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: (await response.json()).data };
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ baseURL: consultationOrigin(), viewport: { width: 390, height: 1000 }, reducedMotion: "reduce" });
let restore: Record<string, unknown> | undefined;
try {
  expect((await api("/buddy/privacy")).data.responderState).toBe("DEMO_FALLBACK");
  await page.goto("/login?next=/buddy");
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel(/^Email address/).fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/buddy");
  async function send(text: string) {
    await page.getByLabel("Message Buddy", { exact: true }).fill(text);
    const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/buddy/messages" && r.request().method() === "POST"), page.getByRole("button", { name: "Send message", exact: true }).click()]);
    expect(response.status()).toBe(201);
    return (await response.json()).data;
  }
  const first = await send("Fictional offline demo: a grounding exercise please.");
  const second = await send("Fictional follow-up: a journaling prompt next please.");
  expect(second.conversationId).toBe(first.conversationId);
  expect(second.messages.at(-1).generation.executionState).toBe("DEMO_FALLBACK");
  expect(second.messages.at(-1).content).not.toBe(first.messages.at(-1).content);
  await expect(page.getByText(/Guided Support.*DEMO_FALLBACK/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(second.messages.at(-1).content, { exact: true })).toBeVisible();
  const stored = await db.schema("buddy_service").from("buddy_messages").select("content").eq("user_id", account.id).eq("conversation_id", first.conversationId);
  expect(stored.error).toBeNull(); expect(stored.data!.length).toBeGreaterThanOrEqual(4);
  expect(stored.data!.every(row => row.content.startsWith("echo:encrypted:v1:"))).toBe(true);
  const privacy = (await api("/settings")).data.privacy;
  restore = { journalAiAnalysisEnabled: privacy.journalAiAnalysisEnabled, buddyHistoryEnabled: privacy.buddyHistoryEnabled, facialAnalysisEnabled: privacy.facialAnalysisEnabled, crisisSupportVisible: privacy.crisisSupportVisible, lockScreenPrivate: privacy.lockScreenPrivate };
  localEnvironment(process.cwd());
  expect((await api("/settings/privacy", "PATCH", { ...restore, buddyHistoryEnabled: false })).status).toBe(200);
  const before = await db.schema("buddy_service").from("buddy_messages").select("id", { count: "exact", head: true }).eq("user_id", account.id);
  await page.reload();
  await expect(page.getByText(/Saved chats are read-only while history saving is off/)).toBeVisible();
  await page.getByRole("button", { name: "New conversation", exact: true }).last().click();
  const temporary = await send("Fictional private demo: a journaling prompt please.");
  expect(temporary.persisted).toBe(false); expect(temporary.conversationId).toBeNull();
  const urgent = await send("Fictional safety regression mentions hurt myself.");
  expect(urgent.persisted).toBe(false); expect(urgent.messages.at(-1).generation).toBeUndefined();
  const after = await db.schema("buddy_service").from("buddy_messages").select("id", { count: "exact", head: true }).eq("user_id", account.id);
  expect(before.error).toBeNull(); expect(after.error).toBeNull(); expect(after.count).toBe(before.count);
  await page.screenshot({ path: "artifacts/model-integration/live-initial-20261030/guided-offline-390.png", fullPage: true });
  const report = { target: LOCAL_API, fingerprint: target.fingerprint, fastApiStopped: true, mode: "DEMO_FALLBACK", twoTurns: true, conversationId: first.conversationId, refreshRestored: true, ciphertextVerified: true, privacyOffNotPersisted: true, urgentSupportIndependent: true };
  writeFileSync("artifacts/model-integration/live-initial-20261030/guided-browser.json", JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report) + "\n");
} finally {
  if (restore) { localEnvironment(process.cwd()); expect((await api("/settings/privacy", "PATCH", restore)).status).toBe(200); }
  await browser.close(); await auth.auth.signOut({ scope: "local" });
}
