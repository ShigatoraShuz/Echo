/** Real local checkpoint selection evidence. No mocked model/API; existing fictional actors only. */
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { LOCAL_API, localEnvironment, localFetch, assertFixtureUser } from "./lib/professional-local-target.mts";
import { modelEvidenceDirectory } from "./lib/model-evidence.mts";

const local = localEnvironment(process.cwd());
const fixture = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
const runtime = JSON.parse(readFileSync("backend/tmp/development-runtime/runtime.json", "utf8"));
const selected = JSON.parse(readFileSync("backend/models/.local/active.json", "utf8"));
if (fixture.fingerprint !== local.fingerprint || runtime.fingerprint !== local.fingerprint || runtime.state !== "ready" || runtime.models.cbt !== selected.tasks.cbt) throw new Error("Matching ready standard local runtime required.");
const identity = selected.tasks.cbt;
const account = fixture.accounts[0];
const evidence = modelEvidenceDirectory("artifacts/model-integration/standard-dev-20261030/switch");
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } };
const auth = createClient(LOCAL_API, local.anonKey, options);
const login = await auth.auth.signInWithPassword({ email: account.email, password: account.password });
if (login.error || !login.data.session) throw new Error("Local fixture sign-in failed.");
assertFixtureUser(login.data.user!, account.email);
const db = createClient(LOCAL_API, local.serviceKey, options);
const api = async (path: string) => {
  const response = await fetch(runtime.backend + "/api/v1" + path, { headers: { Authorization: `Bearer ${login.data.session!.access_token}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
  expect(response.status).toBe(200);
  return (await response.json()).data;
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
let currentPage: import("@playwright/test").Page | undefined;
const requests: { method: string; path: string; status?: number; failed?: string }[] = [];
try {
  const page = await browser.newPage({ baseURL: runtime.frontend, viewport: { width: 390, height: 1000 }, reducedMotion: "reduce" });
  currentPage = page;
  page.on("response", response => { if (new URL(response.url()).origin === runtime.backend) requests.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() }); });
  page.on("requestfailed", request => { requests.push({ method: request.method(), path: new URL(request.url()).pathname, failed: request.failure()?.errorText }); });
  const origins = new Set<string>();
  page.on("request", request => origins.add(new URL(request.url()).origin));
  await page.route("**/*", route => [runtime.frontend, runtime.backend, LOCAL_API].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  await page.goto("/login?next=/buddy");
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel(/^Email address/).fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/buddy");
  await expect(page.getByLabel("Message Buddy", { exact: true })).toBeEnabled();
  await page.getByLabel("Message Buddy", { exact: true }).fill("Fictional checkpoint verification: suggest one gentle reflection question.");
  const buddyStart = performance.now();
  const [chat] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/buddy/messages" && r.request().method() === "POST", { timeout: 120000 }), page.getByRole("button", { name: "Send message", exact: true }).click()]);
  expect(chat.status()).toBe(201);
  const conversation = (await chat.json()).data;
  const reply = conversation.messages.at(-1);
  expect(`${reply.generation.modelId}@${reply.generation.modelVersion}`).toBe(identity);
  expect(reply.generation.executionState).toBe("REAL_PROVISIONAL_MODEL");
  const buddyMs = Math.round(performance.now() - buddyStart);
  await page.reload();
  await expect(page.getByText(reply.content, { exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/buddy.png`, fullPage: true });
  await page.goto("/journal/new");
  await page.getByLabel("Reflection title").fill(`FICTIONAL model selection ${Date.now()}`);
  await page.getByLabel("Start writing", { exact: true }).fill("Fictional student completed a small task and took a calm walk. Local checkpoint switching verification only.");
  await page.getByText("More options", { exact: true }).click();
  await page.getByLabel("Allow a reflective summary after saving").check();
  const button = page.getByRole("button", { name: "Save reflection", exact: true });
  await expect(button).toBeEnabled({ timeout: 45000 });
  const journalStart = performance.now();
  const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/journals" && r.request().method() === "POST", { timeout: 60000 }), button.click()]);
  expect(response.status()).toBe(202);
  const accepted = (await response.json()).data;
  let progress;
  for (let n = 0; n < 60; n++) {
    progress = await api(`/analysis-jobs/${accepted.analysisJobId}/status`);
    if (["completed", "failed", "safety_action_required"].includes(progress.status)) break;
    await new Promise(done => setTimeout(done, 5000));
  }
  expect(progress.status).toBe("completed");
  const journalMs = Math.round(performance.now() - journalStart);
  const result = (await api(`/journals/${accepted.journalId}/analyses`)).result;
  expect(result.isSimulated).toBe(false);
  expect(`${result.stages.cbt.modelId}@${result.stages.cbt.modelVersion}`).toBe(identity);
  expect(result.stages.cbt.executionState).toBe("REAL_PROVISIONAL_MODEL");
  expect(result.researchDiagnostic.rawLogits).toHaveLength(5);
  const stored = await db.schema("ai_analysis").from("analysis_results").select("result_payload,is_simulated").eq("analysis_request_id", accepted.analysisJobId).single();
  expect(stored.error).toBeNull();
  expect(Object.keys(stored.data!.result_payload)).toEqual(["ciphertext"]);
  expect(stored.data!.is_simulated).toBe(false);
  await page.goto(`/journal/${accepted.journalId}`);
  await page.reload();
  await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible();
  await page.screenshot({ path: `${evidence}/journal.png`, fullPage: true });
  // Keep the same application's 120/minute budget intact.
  for (let n = 0; n < 2; n++) await new Promise(done => setTimeout(done, 30000));
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible({ timeout: 45000 });
  await page.goto("/insights/emotion");
  await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible({ timeout: 45000 });
  const messages = await db.schema("buddy_service").from("buddy_messages").select("content").eq("user_id", account.id).eq("conversation_id", conversation.conversationId);
  expect(messages.error).toBeNull();
  expect(messages.data!.every(row => row.content.startsWith("echo:encrypted:v1:"))).toBe(true);
  const report = { standardEntryPoint: "npm run dev", target: LOCAL_API, fingerprint: local.fingerprint, identity,
    buddyMs, journalMs, journalId: accepted.journalId, jobId: accepted.analysisJobId, conversationId: conversation.conversationId,
    realBuddyGeneration: true, realJournalGeneration: true, realXlmRawLogits: true, encryptedResults: true,
    encryptedConversation: true, refreshRestoration: true, dashboard: true, insights: true,
    actualRequestOrigins: [...origins], externalRequestsBlocked: true };
  writeFileSync(`${evidence}/results.json`, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report) + "\n");
} catch (error) {
  await currentPage?.screenshot({ path: `${evidence}/failure.png`, fullPage: true }).catch(() => {});
  writeFileSync(`${evidence}/failure.json`, JSON.stringify({ identity, failure: error instanceof Error ? error.message : "Failure", requests, alerts: await currentPage?.getByRole("alert").allTextContents().catch(() => []) }, null, 2));
  throw error;
} finally { await browser.close(); await auth.auth.signOut({ scope: "local" }); }
