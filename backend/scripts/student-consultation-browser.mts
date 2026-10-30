import { consultationOrigin } from "./lib/consultation-origin.mts";
import type { SelfReportedPhq8 } from "@echo/contracts";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { localEnvironment, localFetch, LOCAL_API, FIXTURE_TAG, assertFixtureUser } from "./lib/professional-local-target.mts";

const target = localEnvironment(process.cwd());
const base = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
const fixtures = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (base.tag !== FIXTURE_TAG || base.fingerprint !== target.fingerprint || fixtures.fingerprint !== target.fingerprint || fixtures.tag !== "echo-student-consultation-v1") throw new Error("Local fixture mismatch");
const evidence = "artifacts/model-integration/student-completion-20261030";
mkdirSync(evidence, { recursive: true });
if (existsSync(`${evidence}/browser-results.json`)) copyFileSync(`${evidence}/browser-results.json`, `${evidence}/browser-attempt-${Date.now()}.json`);
type Journey = Record<string, unknown> & {
  phq8: SelfReportedPhq8;
  buddy: { conversationId: string; restored: boolean; source: string; foreignStatus: number };
};
const report: { target: string; fingerprint: string; journeys: Journey[]; requests: { method: string; path: string; status: number }[]; failure?: string } = { target: LOCAL_API, fingerprint: target.fingerprint, journeys: [], requests: [] };
const save = () => writeFileSync(`${evidence}/browser-results.json`, JSON.stringify(report, null, 2));
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } };
for (let attempt = 0; attempt < 30; attempt++) {
  const ready = await fetch("http://127.0.0.1:4300/api/v1/verification", { redirect: "error", signal: AbortSignal.timeout(2000) }).then(r => r.status === 401).catch(() => false);
  if (ready) break;
  if (attempt === 29) throw new Error("Local backend did not become ready");
  await new Promise(resolve => setTimeout(resolve, 1000));
}
const database = createClient(LOCAL_API, target.serviceKey, options);
const sessions = [];
for (const account of fixtures.accounts) {
  const auth = createClient(LOCAL_API, target.anonKey, options);
  const login = await auth.auth.signInWithPassword({ email: account.email, password: account.password });
  if (login.error || !login.data.session) throw new Error("Local fixture sign-in failed");
  assertFixtureUser(login.data.user!, account.email);
  if (login.data.user!.id !== account.id || login.data.user!.app_metadata.consultation_demo !== true) throw new Error("Wrong fixture");
  sessions.push({ account, auth, token: login.data.session.access_token });
}
async function api(index: number, path: string, method = "GET", body?: unknown, key?: string) {
  const response = await fetch(`http://127.0.0.1:4300/api/v1${path}`, { method, redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${sessions[index].token}`, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await response.json().catch(() => null);
  return { status: response.status, data: json?.data, error: json?.error?.code };
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
let lastPage: import("@playwright/test").Page | undefined;
try {
  for (const [index, width] of [1440, 390].entries()) {
    if (index) for (let n = 0; n < 2; n++) await new Promise(resolve => setTimeout(resolve, 30000));
    const context = await browser.newContext({ baseURL: consultationOrigin(), viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    lastPage = page;
    page.on("response", r => { const u = new URL(r.url()); if (u.origin === "http://127.0.0.1:4300") report.requests.push({ method: r.request().method(), path: u.pathname, status: r.status() }); });
    const journey = { width, studentId: sessions[index].account.id } as Journey;
    report.journeys.push(journey); save();
    const verification = await api(index, "/verification");
    if (verification.data?.accessRequirement === "trusted_contact") expect((await api(index, "/settings/trusted-contacts", "POST", {
      contactName: "Fictional Consultation Contact", contactEmail: "consultation-contact@example.invalid", contactPhone: null,
      relationship: "Synthetic fixture", isPrimary: true, permissionAcknowledged: true,
    })).status).toBe(201);
    const settings = await api(index, "/settings"), privacy = settings.data.privacy;
    const setConsent = (enabled: boolean) => api(index, "/settings/privacy", "PATCH", {
      journalAiAnalysisEnabled: enabled, buddyHistoryEnabled: true,
      facialAnalysisEnabled: privacy.facialAnalysisEnabled, crisisSupportVisible: privacy.crisisSupportVisible,
      lockScreenPrivate: privacy.lockScreenPrivate,
    });
    expect((await setConsent(false)).status).toBe(200);
    journey.consentDenied = (await api(index, "/journals", "POST", { title: "Fictional denied analysis", body: "Synthetic text.", mood: "calm", analysisConsent: true }, randomUUID())).status;
    expect(journey.consentDenied).toBe(403);
    expect((await setConsent(true)).status).toBe(200);
    await page.goto("/login?next=/dashboard");
    await page.getByRole("button", { name: "Use password instead" }).click();
    await page.getByLabel(/^Email address/).fill(sessions[index].account.email);
    await page.locator('input[type="password"]').fill(sessions[index].account.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(url => !url.pathname.includes("login"), { timeout: 60000 });
    journey.login = true;
    await page.goto("/journal/new");
    await page.getByLabel("Reflection title").fill(`FICTIONAL consultation ${width} ${Date.now()}`);
    await page.getByLabel("Start writing", { exact: true }).fill("Fictional student completed a small task and took a calm walk. Local thesis demonstration, not participant data.");
    await expect(page.getByText(/Self-reported mood/)).toBeVisible();
    await page.getByText("More options", { exact: true }).click();
    await page.getByLabel("Allow a reflective summary after saving").check();
    const button = page.getByRole("button", { name: "Save reflection", exact: true });
    await expect(button).toBeEnabled({ timeout: 45000 });
    const start = performance.now();
    const [response] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/journals" && r.request().method() === "POST", { timeout: 60000 }), button.click()]);
    expect(response.status()).toBe(202);
    const accepted = (await response.json()).data;
    journey.journalId = accepted.journalId; journey.jobId = accepted.analysisJobId; save();
    let status;
    for (let attempt = 0; attempt < 100; attempt++) {
      status = await api(index, `/analysis-jobs/${accepted.analysisJobId}/status`);
      if (["completed", "failed", "safety_action_required"].includes(status.data?.status)) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    expect(status?.data.status).toBe("completed");
    journey.submitToPersistMs = Math.round(performance.now() - start);
    const result = (await api(index, `/journals/${accepted.journalId}/analyses`)).data.result;
    journey.research = result.researchDiagnostic; journey.stages = result.stages;
    expect(result.isSimulated).toBe(false);
    expect(result.researchDiagnostic?.executionState).toBe("REAL_PROVISIONAL_MODEL");
    expect(result.researchDiagnostic.rawLogits).toHaveLength(5);
    expect(result.stages.peak.executionState).toBe("UNAVAILABLE");
    expect(result.stages.phq8.result).toBeNull();
    const close = page.getByRole("button", { name: "Close analysis progress", exact: true });
    if (await close.isVisible()) await close.click();
    await page.goto(`/journal/${accepted.journalId}`);
    const panel = page.getByRole("region", { name: "Independent model analysis" });
    await expect(panel.getByText(/Local fictional research demonstration/).first()).toBeVisible({ timeout: 45000 });
    await page.reload(); await expect(panel).toBeVisible();
    journey.journalRefresh = true;
    journey.foreignJournal = (await api(1 - index, `/journals/${accepted.journalId}`)).status;
    journey.foreignAnalysis = (await api(1 - index, `/journals/${accepted.journalId}/analyses`)).status;
    journey.foreignProgress = (await api(1 - index, `/analysis-jobs/${accepted.analysisJobId}/status`)).status;
    expect(journey.foreignJournal).toBe(404); expect([403, 404]).toContain(journey.foreignAnalysis); expect(journey.foreignProgress).toBe(404);
    const stored = await database.schema("ai_analysis").from("analysis_results").select("id,result_payload,is_simulated,phq8_score,severity").eq("analysis_request_id", accepted.analysisJobId).single();
    expect(stored.error).toBeNull(); expect(Object.keys(stored.data!.result_payload)).toEqual(["ciphertext"]);
    expect(stored.data!.phq8_score).toBeNull(); expect(stored.data!.severity).toBeNull();
    journey.encryptedResult = true; journey.resultId = stored.data!.id;
    for (const theme of ["light", "dark"]) {
      await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      const audit = await new AxeBuilder({ page }).include('[aria-label="Independent model analysis"]').withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(audit.violations.map(v => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await page.screenshot({ path: `${evidence}/journal-${width}-${theme}.png`, fullPage: true });
      await panel.screenshot({ path: `${evidence}/analysis-${width}-${theme}.png` });
    }
    journey.analysisAccessibility = "0 WCAG A/AA violations in light and dark";
    await page.goto("/dashboard"); await expect(panel).toBeVisible({ timeout: 45000 });
    journey.dashboard = true;
    const welcome = page.getByRole("button", { name: /close dialog/i });
    await welcome.waitFor({ timeout: 2500 }).catch(() => {});
    if (await welcome.isVisible()) await welcome.click();
    await page.getByRole("button", { name: "Open check-in panel" }).click();
    const history = page.getByText("Self-reported PHQ-8 history", { exact: true });
    const wellnessBefore = await api(index, "/wellness");
    if (!wellnessBefore.data.assessment.selfReports?.length) {
      await page.getByRole("button", { name: "Take the check-in" }).click();
      const radios = page.getByRole("radio", { name: "Several days", exact: true });
      for (let n = 0; n < (index ? 8 : 2); n++) await radios.nth(n).check();
      const audit = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(audit.violations.map(v => v.id)).toEqual([]);
      const [saved] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/wellness/phq8/self-report" && r.request().method() === "POST"), page.getByRole("button", { name: "Save check-in", exact: true }).click()]);
      expect(saved.status()).toBe(200);
      journey.phq8 = (await saved.json()).data;
      expect(journey.phq8.scored_symptom_count).toBe(index ? 8 : 2);
      expect(journey.phq8.total).toBe(index ? 8 : null);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    } else journey.phq8 = wellnessBefore.data.assessment.selfReports[0];
    await page.reload();
    await page.getByRole("button", { name: "Close dialog", exact: true }).waitFor({ timeout: 2500 }).catch(() => {});
    if (await page.getByRole("button", { name: "Close dialog", exact: true }).isVisible()) await page.getByRole("button", { name: "Close dialog", exact: true }).click();
    await page.getByRole("button", { name: "Open check-in panel" }).click();
    await expect(history).toBeVisible();
    const wellness = await api(index, "/wellness");
    expect(wellness.data.assessment.selfReports[0].responses).toEqual(journey.phq8.responses);
    const storedReport = await database.schema("insights_service").from("phq8_assessments")
      .select("assessment_ciphertext,responses,score,severity").eq("user_id", sessions[index].account.id).eq("id", journey.phq8.id).single();
    expect(storedReport.error).toBeNull();
    expect(storedReport.data!.assessment_ciphertext.startsWith("echo:encrypted:v1:")).toBe(true);
    expect([storedReport.data!.responses, storedReport.data!.score, storedReport.data!.severity]).toEqual([null, null, null]);
    journey.phq8Encrypted = true;
    const foreignWellness = await api(1 - index, "/wellness");
    expect(foreignWellness.data.assessment.selfReports.some((r: { id: string }) => r.id === journey.phq8.id)).toBe(false);
    journey.phq8RefreshAndIsolation = true;
    save();
    // This regression intentionally includes full reloads and direct ownership probes.
    // Respect the unchanged 120/minute application budget before the next feature group.
    for (let n = 0; n < 2; n++) await new Promise(resolve => setTimeout(resolve, 30000));
    await page.goto("/insights/emotion"); await expect(panel).toBeVisible({ timeout: 45000 }); journey.insights = true;
    await page.goto("/buddy");
    await page.getByLabel("Message Buddy", { exact: true }).fill("Fictional consultation: a grounding exercise please.");
    const [chat] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/buddy/messages" && r.request().method() === "POST", { timeout: 60000 }), page.getByRole("button", { name: "Send message", exact: true }).click()]);
    expect(chat.status()).toBe(201); const conversation = (await chat.json()).data;
    await expect(page.getByText(/DEMO_FALLBACK.*prewritten/).first()).toBeVisible();
    await page.reload(); await expect(page.getByText(/DEMO_FALLBACK.*prewritten/).first()).toBeVisible();
    const savedChat = await api(index, `/buddy/conversations/${conversation.conversationId}`);
    expect(savedChat.data.messages.at(-1).generation.executionState).toBe("DEMO_FALLBACK");
    await expect(page.getByText(savedChat.data.messages.at(-1).content, { exact: true })).toBeVisible();
    const storedMessages = await database.schema("buddy_service").from("buddy_messages").select("content")
      .eq("user_id", sessions[index].account.id).eq("conversation_id", conversation.conversationId);
    expect(storedMessages.error).toBeNull();
    expect(storedMessages.data!.length).toBeGreaterThanOrEqual(2);
    expect(storedMessages.data!.every(row => row.content.startsWith("echo:encrypted:v1:"))).toBe(true);
    journey.buddyEncrypted = true;
    journey.buddy = { conversationId: conversation.conversationId, restored: true, source: "DEMO_FALLBACK", foreignStatus: (await api(1 - index, `/buddy/conversations/${conversation.conversationId}`)).status };
    expect([403, 404]).toContain(journey.buddy.foreignStatus);
    await page.screenshot({ path: `${evidence}/buddy-${width}.png`, fullPage: true });
    await page.goto("/settings"); await expect(page.getByRole("heading", { name: /settings/i }).first()).toBeVisible({ timeout: 45000 }); journey.settings = true;
    // The full-bleed mobile Journal deliberately omits the desktop profile menu.
    await page.setViewportSize({ width: 1440, height: 1000 });
    journey.logoutViewport = 1440;
    await page.goto("/journal"); await page.getByRole("button", { name: /^Profile menu/ }).click(); await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
    await page.waitForURL(url => url.pathname.includes("login") || url.pathname === "/"); await page.goto("/journal/new"); await page.waitForURL(/login/); journey.logoutProtected = true;
    save(); process.stdout.write(JSON.stringify({ width, completed: true, submitToPersistMs: journey.submitToPersistMs }) + "\n");
    await context.close();
  }
} catch (error) {
  if (lastPage && !lastPage.isClosed()) {
    writeFileSync(`${evidence}/failure-visible-text.txt`, await lastPage.locator("body").innerText());
    await lastPage.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  }
  report.failure = error instanceof Error ? error.message : "Unknown browser failure"; save(); throw error;
}
finally { save(); await browser.close(); for (const s of sessions) await s.auth.auth.signOut({ scope: "local" }); }
