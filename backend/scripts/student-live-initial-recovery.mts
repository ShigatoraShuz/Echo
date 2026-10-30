import { consultationOrigin } from "./lib/consultation-origin.mts";
import { modelEvidenceDirectory } from "./lib/model-evidence.mts";
/** Run offline only after stopping the owned loopback FastAPI, then recover after restarting it. */
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { localEnvironment, localFetch, LOCAL_API, assertFixtureUser } from "./lib/professional-local-target.mts";

const mode = process.argv[2];
if (!["offline", "recover"].includes(mode)) throw new Error("Use offline|recover");
const target = localEnvironment(process.cwd()), fixtures = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (fixtures.fingerprint !== target.fingerprint || fixtures.tag !== "echo-student-consultation-v1") throw new Error("Fixture mismatch");
const account = fixtures.accounts[0], evidence = modelEvidenceDirectory("artifacts/model-integration/live-initial-20261030");
const reportPath = `${evidence}/recovery-results.json`;
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : { target: LOCAL_API, fingerprint: target.fingerprint };
const auth = createClient(LOCAL_API, target.anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } });
const login = await auth.auth.signInWithPassword({ email: account.email, password: account.password });
if (login.error || !login.data.session) throw new Error("Fixture login failed");
assertFixtureUser(login.data.user!, account.email);
const api = async (path: string) => {
  const response = await fetch(`http://127.0.0.1:4300/api/v1${path}`, { headers: { Authorization: `Bearer ${login.data.session!.access_token}` }, redirect: "error" });
  return { status: response.status, data: (await response.json()).data };
};
const reachable = await fetch("http://127.0.0.1:8100/openapi.json", { signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false);
expect(reachable).toBe(mode === "recover");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ baseURL: consultationOrigin(), viewport: { width: 390, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
try {
  await page.goto("/login?next=/journal/new"); await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel(/^Email address/).fill(account.email); await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click(); await page.waitForURL(u => !u.pathname.includes("login"));
  await page.getByLabel("Reflection title").fill(`FICTIONAL ${mode} recovery ${Date.now()}`);
  await page.getByLabel("Start writing", { exact: true }).fill("Fictional student completed a small task and took a calm walk. Local outage and recovery test only.");
  await page.getByText("More options", { exact: true }).click(); await page.getByLabel("Allow a reflective summary after saving").check();
  const button = page.getByRole("button", { name: "Save reflection", exact: true }); await expect(button).toBeEnabled({ timeout: 45000 });
  const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/journals" && r.request().method() === "POST", { timeout: 60000 }), button.click()]);
  expect(response.status()).toBe(202); const accepted = (await response.json()).data;
  let progress;
  for (let n = 0; n < 90; n++) {
    progress = await api(`/analysis-jobs/${accepted.analysisJobId}/status`);
    if (["completed", "failed"].includes(progress.data?.status)) break;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  expect(progress?.data.status).toBe(mode === "offline" ? "failed" : "completed");
  if (mode === "offline") await expect(page.getByRole("heading", { name: "Analysis could not be completed" })).toBeVisible({ timeout: 15000 });
  const close = page.getByRole("button", { name: "Close analysis progress", exact: true }); if (await close.isVisible()) await close.click();
  await page.goto(`/journal/${accepted.journalId}`); await page.reload();
  await expect(page.getByText(/Local outage and recovery test only/).first()).toBeVisible();
  const analysis = await api(`/journals/${accepted.journalId}/analyses`);
  if (mode === "recover") {
    expect(analysis.data.result.researchDiagnostic.executionState).toBe("REAL_PROVISIONAL_MODEL");
    expect(analysis.data.result.stages.cbt.executionState).toBe("REAL_PROVISIONAL_MODEL");
    expect(analysis.data.result.stages.cbt.modelId).toBe("echo-qwen2-cbt-drive-export");
    await expect(page.getByRole("region", { name: "Local fictional research demonstration" })).toBeVisible();
    if (report.offline) expect((await api(`/journals/${report.offline.journalId}`)).status).toBe(200);
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible({ timeout: 45000 });
    await page.goto("/insights/emotion");
    await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible({ timeout: 45000 });
    report.currentRuntimeDashboardAndInsights = true;
    const unauthenticated = await fetch("http://127.0.0.1:8100/engineering/v2/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Fictional" }) });
    expect(unauthenticated.status).toBe(401);
    report.directAiUnauthenticated = 401;
  } else {
    expect(analysis.data?.result ?? null).toBeNull();
    await expect(page.getByText(/failed result is not a low distress score/)).toBeVisible();
    expect((await api(`/journals/${accepted.journalId}/analysis-state`)).data.reason).toBe("PROCESSING_FAILED");
    await page.getByRole("button", { name: "Check analysis status", exact: true }).click();
    await expect(page.getByText(/failed result is not a low distress score/)).toBeVisible();
    await page.goto("/buddy"); await page.getByLabel("Message Buddy", { exact: true }).fill("Fictional offline test: a journaling prompt please.");
    const [chat] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/buddy/messages" && r.request().method() === "POST"), page.getByRole("button", { name: "Send message", exact: true }).click()]);
    expect(chat.status()).toBe(503); await expect(page.getByRole("alert").filter({ hasText: /unavailable/ })).toBeVisible();
    report.realModelOutageShowsError = true;
  }
  await page.screenshot({ path: `${evidence}/${mode}-recovery-390.png`, fullPage: true });
  report[mode] = { journalId: accepted.journalId, jobId: accepted.analysisJobId, actualStatus: progress.data.status, journalPreservedAfterRefresh: true, rawResearchOutput: mode === "recover" };
  writeFileSync(reportPath, JSON.stringify(report, null, 2)); process.stdout.write(JSON.stringify(report) + "\n");
} finally { await browser.close(); await auth.auth.signOut({ scope: "local" }); }
