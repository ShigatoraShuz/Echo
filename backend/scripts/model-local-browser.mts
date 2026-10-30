function print(value: unknown) {
  process.stdout.write((typeof value === "string" ? value : JSON.stringify(value)) + "\n");
}
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";
import {
  localEnvironment,
  localFetch,
  LOCAL_API,
  FIXTURE_TAG,
  assertFixtureUser,
} from "./lib/professional-local-target.mts";

const root = process.cwd(),
  target = localEnvironment(root);
const fixture = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
if (fixture.tag !== FIXTURE_TAG || fixture.fingerprint !== target.fingerprint || !fixture.complete)
  throw new Error("Fixture mismatch");
const mode = process.argv[2] ?? "explore";
const evidenceDirectory = resolve(process.env.ECHO_MODEL_EVIDENCE_DIR ?? "artifacts/model-integration");
const evidenceRoot = resolve("artifacts/model-integration");
if (evidenceDirectory !== evidenceRoot && !evidenceDirectory.startsWith(evidenceRoot + sep))
  throw new Error("Browser evidence must stay inside artifacts/model-integration");
const auth = createClient(LOCAL_API, target.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: localFetch },
});
const login = await auth.auth.signInWithPassword({
  email: "client@professional.echo.test",
  password: fixture.accounts.client.password,
});
if (login.error || !login.data.session) throw new Error("Synthetic password login failed");
assertFixtureUser(login.data.user!, "client@professional.echo.test");
const token = login.data.session.access_token;
async function api(path: string, method = "GET", body?: unknown, key?: string, bearer = token) {
  const response = await fetch(`http://127.0.0.1:4300/api/v1${path}`, {
    signal: AbortSignal.timeout(30000),
    method,
    redirect: "error",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  baseURL: "http://127.0.0.1:3100",
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const requests: { method: string; path: string; status: number }[] = [];
page.on("response", (response) => {
  const url = new URL(response.url());
  if (url.origin === "http://127.0.0.1:4300")
    requests.push({ method: response.request().method(), path: url.pathname, status: response.status() });
});
try {
  const verified = await api("/verification");
  print(JSON.stringify({ verification: verified.data?.data?.accessRequirement, status: verified.status }));
  if (verified.data?.data?.accessRequirement === "trusted_contact") {
    const contact = await api("/settings/trusted-contacts", "POST", {
      contactName: "Fictional AI Test Contact",
      contactEmail: "fictional-ai-contact@example.invalid",
      contactPhone: null,
      relationship: "Synthetic fixture",
      isPrimary: true,
      permissionAcknowledged: true,
    });
    if (contact.status !== 201) throw new Error(`Trusted contact setup ${contact.status}`);
  }
  await page.goto("/login?next=/journal/new");
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel(/^Email address/).fill("client@professional.echo.test");
  await page.locator('input[type="password"]').fill(fixture.accounts.client.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 60000 });
  await page.waitForTimeout(2000);
  mkdirSync(evidenceDirectory, { recursive: true });
  if (mode === "explore" || mode === "inspect") {
    if (mode === "inspect") {
      const path = process.argv[3];
      if (!/^\/journal\/[a-f0-9-]{36}$/.test(path ?? ""))
        throw new Error("An existing local synthetic journal URL is required");
      await page.goto(path);
      if (process.argv[4] === "dark" || process.argv[4] === "mobile") {
        await page.setViewportSize({ width: 390, height: 1000 });
      }
      if (process.argv[4] === "dark") {
        await page.evaluate(() => document.documentElement.classList.add("dark"));
      }
      await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .include('[aria-label="Independent model analysis"]')
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      print(
        JSON.stringify({
          violations: audit.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({ target: n.target, failure: n.failureSummary, html: n.html })),
          })),
        }),
      );
      expect(audit.violations.map((issue) => issue.id)).toEqual([]);
      const analysis = await api(`${path.replace(/^\/journal\//, "/journals/")}/analyses`);
      expect(analysis.status).toBe(200);
      const result = analysis.data.data.result;
      const journalPanel = page.getByRole("region", { name: "Independent model analysis" });
      await expect(journalPanel.getByRole("heading", { name: "Text emotion", exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await page.screenshot({ path: `${evidenceDirectory}/inspect-journal.png`, fullPage: true });
      await page.goto("/dashboard");
      const dashboardPanel = page.getByRole("region", { name: "Independent model analysis" });
      await expect(dashboardPanel).toBeVisible({ timeout: 45000 });
      await expect(dashboardPanel.getByRole("heading", { name: "Text emotion", exact: true })).toBeVisible();
      if (result.stages.peak.modelId)
        await expect(dashboardPanel.getByText(result.stages.peak.modelId, { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await page.screenshot({ path: `${evidenceDirectory}/inspect-dashboard.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/journal");
      await page.getByRole("button", { name: /^Profile menu/ }).click();
      await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
      await page.waitForURL((url) => url.pathname.includes("login") || url.pathname === "/", { timeout: 30000 });
      await page.goto("/journal/new");
      await page.waitForURL(/login/, { timeout: 30000 });
      writeFileSync(
        `${evidenceDirectory}/read-only-inspection.json`,
        JSON.stringify(
          {
            mode: "inspect",
            newAnalysisSubmitted: false,
            isSimulated: result.isSimulated,
            journalPath: path,
            mobile: ["dark", "mobile"].includes(process.argv[4] ?? ""),
            journalRefreshed: true,
            dashboardRendered: true,
            modelIdentityRendered: result.stages.peak.modelId,
            overflow: false,
            accessibilityViolations: [],
            logoutProtected: true,
          },
          null,
          2,
        ),
      );
    }
    print(JSON.stringify({ url: page.url(), text: (await page.locator("body").innerText()).slice(-9000), requests }));
    await page.screenshot({ path: `${evidenceDirectory}/local-browser-explore.png`, fullPage: true });
  } else {
    const report: { mode: string; checks: Record<string, unknown>; journeys: unknown[]; requests?: unknown } = {
      mode,
      checks: {},
      journeys: [],
    };
    const settings = await api("/settings");
    const privacy = settings.data.data.privacy;
    const setConsent = (enabled: boolean) =>
      api("/settings/privacy", "PATCH", {
        journalAiAnalysisEnabled: enabled,
        buddyHistoryEnabled: true,
        facialAnalysisEnabled: privacy.facialAnalysisEnabled,
        crisisSupportVisible: privacy.crisisSupportVisible,
        lockScreenPrivate: privacy.lockScreenPrivate,
      });
    expect((await setConsent(false)).status).toBe(200);
    const denied = await api(
      "/journals",
      "POST",
      { title: "SYNTHETIC consent denial", body: "Fictional text only.", mood: "calm", analysisConsent: true },
      randomUUID(),
    );
    expect(denied.status).toBe(403);
    report.checks.consentDenied = denied.status;
    expect((await setConsent(true)).status).toBe(200);
    const noAuth = await fetch("http://127.0.0.1:8100/engineering/v2/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Fictional" }),
    });
    expect(noAuth.status).toBe(401);
    report.checks.directUnauthenticatedAi = noAuth.status;
    const other = createClient(LOCAL_API, target.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: localFetch },
    });
    const otherLogin = await other.auth.signInWithPassword({
      email: "org-admin@professional.echo.test",
      password: fixture.accounts["org-admin"].password,
    });
    if (otherLogin.error || !otherLogin.data.session) throw new Error("Second synthetic login failed");
    const otherToken = otherLogin.data.session.access_token;
    const database = createClient(LOCAL_API, target.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: localFetch },
    });
    for (const width of [1440, 390]) {
      print(JSON.stringify({ step: "journal", mode, width }));
      // Keep the normal 120/minute API security budget enabled. Two full UI
      // journeys + direct ownership probes intentionally span separate windows.
      if (width === 390)
        for (let pause = 0; pause < 2; pause++) await new Promise((resolve) => setTimeout(resolve, 30000));
      const closeProgress = page.getByRole("button", { name: "Close analysis progress", exact: true });
      if (await closeProgress.isVisible()) await closeProgress.click();
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/journal/new");
      await page.getByLabel("Reflection title").fill(`SYNTHETIC AI integration ${mode} ${width} ${Date.now()}`);
      await page
        .getByLabel("Start writing", { exact: true })
        .fill(
          "Fictional thesis test student: I reflected on a small kind action and a quiet walk today. This is synthetic text, not participant data.",
        );
      await page.getByText("More options", { exact: true }).click();
      await page.getByLabel("Allow a reflective summary after saving").check();
      const saveButton = page.getByRole("button", { name: "Save reflection", exact: true });
      await expect(saveButton).toBeEnabled({ timeout: 45000 });
      await page.screenshot({ path: `${evidenceDirectory}/local-editor-state.png`, fullPage: true });
      const start = performance.now();
      const [submitted] = await Promise.all([
        page.waitForResponse(
          (r) => new URL(r.url()).pathname === "/api/v1/journals" && r.request().method() === "POST",
          { timeout: 60000 },
        ),
        saveButton.click(),
      ]);
      if (submitted.status() !== 202)
        throw new Error(`Journal submission ${submitted.status()}: ${JSON.stringify((await submitted.json()).error)}`);
      const accepted = (await submitted.json()).data;
      let progress;
      for (let attempt = 0; attempt < 90; attempt++) {
        progress = await api(`/analysis-jobs/${accepted.analysisJobId}/status`);
        if (["completed", "failed", "safety_action_required"].includes(progress.data?.data?.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      expect(progress?.data.data.status).toBe("completed");
      const durationMs = Math.round(performance.now() - start);
      const analysis = await api(`/journals/${accepted.journalId}/analyses`);
      const result = analysis.data.data.result;
      expect(result.schemaVersion).toBe("echo-model-pipeline-v2");
      expect(result.isSimulated).toBe(mode !== "real");
      expect(result.stages.face.status).toBe("unavailable");
      expect(analysis.data.data.phq8_score).toBeNull();
      if (mode !== "real") expect(result.stages.peak.status).toBe("completed");
      if (mode === "synthetic" || mode === "swap") {
        expect(result.stages.phq8.result.total).toBeNull();
        expect(result.stages.phq8.result.scored_symptom_count).toBe(4);
      }
      if (await closeProgress.isVisible()) await closeProgress.click();
      await page.goto(`/journal/${accepted.journalId}`);
      const panel = page.getByRole("region", { name: "Independent model analysis" });
      await expect(panel).toBeVisible({ timeout: 45000 });
      if (mode === "synthetic" || mode === "swap") await expect(panel.getByText("Partial subtotal: 6")).toBeVisible();
      if (mode === "swap") await expect(panel.getByText(/echo-random-roberta-engineering/)).toBeVisible();
      await page.reload();
      await expect(page.getByRole("region", { name: "Independent model analysis" })).toBeVisible({ timeout: 30000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      expect(overflow).toBe(false);
      const accessibility = await new AxeBuilder({ page })
        .include('[aria-label="Independent model analysis"]')
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(accessibility.violations.map((issue) => issue.id)).toEqual([]);
      await page.screenshot({ path: `${evidenceDirectory}/${mode}-${width}.png`, fullPage: true });
      if (width === 390) {
        await page.evaluate(() => document.documentElement.classList.add("dark"));
        await page.screenshot({ path: `${evidenceDirectory}/${mode}-390-dark.png`, fullPage: true });
        const dark = await new AxeBuilder({ page })
          .include('[aria-label="Independent model analysis"]')
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(dark.violations.map((issue) => issue.id)).toEqual([]);
        await page.evaluate(() => document.documentElement.classList.remove("dark"));
      }
      const unauthorized = await api(
        `/journals/${accepted.journalId}/analyses`,
        "GET",
        undefined,
        undefined,
        otherToken,
      );
      expect([403, 404]).toContain(unauthorized.status);
      const rawForeign = await api(`/journals/${accepted.journalId}`, "GET", undefined, undefined, otherToken);
      expect(rawForeign.status).toBe(404);
      const foreignStatus = await api(
        `/analysis-jobs/${accepted.analysisJobId}/status`,
        "GET",
        undefined,
        undefined,
        otherToken,
      );
      expect(foreignStatus.status).toBe(404);
      const stored = await database
        .schema("ai_analysis")
        .from("analysis_results")
        .select("id,result_payload,is_simulated,severity,phq8_score,schema_version")
        .eq("analysis_request_id", accepted.analysisJobId)
        .single();
      expect(stored.error).toBeNull();
      expect(Object.keys(stored.data!.result_payload)).toEqual(["ciphertext"]);
      expect(stored.data!.is_simulated).toBe(mode !== "real");
      expect(stored.data!.severity).toBeNull();
      expect(stored.data!.phq8_score).toBeNull();
      await page.goto("/dashboard");
      const dashboardPanel = page.getByRole("region", { name: "Independent model analysis" });
      await expect(dashboardPanel).toBeVisible({ timeout: 45000 });
      await expect(dashboardPanel.getByRole("heading", { name: "Text emotion", exact: true })).toBeVisible();
      if (result.stages.peak.modelId)
        await expect(dashboardPanel.getByText(result.stages.peak.modelId, { exact: false })).toBeVisible();
      await page.screenshot({ path: `${evidenceDirectory}/${mode}-${width}-dashboard.png`, fullPage: true });
      report.journeys.push({
        width,
        journalId: accepted.journalId,
        jobId: accepted.analysisJobId,
        resultId: stored.data!.id,
        submitToPersistMs: durationMs,
        stageDurationsMs: Object.fromEntries(
          Object.entries(result.stages).map(([task, stage]) => [task, (stage as { durationMs: number }).durationMs]),
        ),
        peakModelId: result.stages.peak.modelId,
        accessibilityViolations: [],
        darkStyleChecked: width === 390,
        stages: Object.fromEntries(
          Object.entries(result.stages).map(([k, s]) => [k, (s as { status: string }).status]),
        ),
        overall: result.overallStatus,
        uiRendered: true,
        dashboardRendered: true,
        refreshPersisted: true,
        encrypted: true,
        crossUserStatus: unauthorized.status,
        crossUserProgressStatus: foreignStatus.status,
        overflow: false,
      });
    }
    await page.goto("/buddy");
    await page
      .getByLabel("Message Buddy", { exact: true })
      .fill("Fictional thesis test: help me reflect on a kind action today.");
    const [chat] = await Promise.all([
      page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/v1/buddy/messages" && r.request().method() === "POST",
        { timeout: 60000 },
      ),
      page.getByRole("button", { name: "Send message", exact: true }).click(),
    ]);
    if (mode === "real" || mode === "partial") {
      expect(chat.status()).toBe(503);
      await expect(page.getByText(/Trained model generation.*unavailable/).first()).toBeVisible();
      report.checks.buddyMissingModel = { status: 503, visible: true };
    } else {
      expect(chat.status()).toBe(201);
      const conversation = (await chat.json()).data;
      await expect(page.getByText("SYNTHETIC E2E FIXTURE — no trained generation").first()).toBeVisible();
      await page.reload();
      // Real saved conversation ownership and attribution, including refresh retrieval.
      const saved = await api(`/buddy/conversations/${conversation.conversationId}`);
      expect(saved.status).toBe(200);
      expect(saved.data.data.messages.at(-1).generation.executionMode).toBe("synthetic");
      const foreign = await api(
        `/buddy/conversations/${conversation.conversationId}`,
        "GET",
        undefined,
        undefined,
        otherToken,
      );
      expect([403, 404]).toContain(foreign.status);
      report.checks.buddy = {
        status: 201,
        conversationId: conversation.conversationId,
        sharedCbtModel: saved.data.data.messages.at(-1).generation.modelId,
        visible: true,
        encryptedRefreshRetrieval: true,
        crossUser: foreign.status,
      };
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/journal");
    await page.getByRole("button", { name: /^Profile menu/ }).click();
    const logout = page.getByRole("menuitem", { name: "Log out", exact: true });
    await logout.click();
    await page.waitForURL((url) => url.pathname.includes("login") || url.pathname === "/", { timeout: 30000 });
    await page.goto("/journal/new");
    await page.waitForURL(/login/, { timeout: 30000 });
    report.checks.logoutProtected = true;
    report.requests = requests;
    writeFileSync(`${evidenceDirectory}/${mode}-browser-results.json`, JSON.stringify(report, null, 2));
    print(JSON.stringify({ ...report, requests: requests.length }));
    await other.auth.signOut({ scope: "local" });
  }
} catch (error) {
  print(
    JSON.stringify({
      failedUrl: page.url(),
      visibleText: (await page.locator("body").innerText()).slice(-3500),
      requestCount: requests.length,
    }),
  );
  await page.screenshot({ path: `${evidenceDirectory}/local-browser-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await auth.auth.signOut({ scope: "local" });
}
