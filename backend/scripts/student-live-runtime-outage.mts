/** Genuine bounded outage of the supervisor-owned local FastAPI, with real browser recovery. */
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { LOCAL_API, localEnvironment, localFetch, assertFixtureUser } from "./lib/professional-local-target.mts";
import { waitForConsultation } from "./lib/consultation-startup.mts";
import { modelEvidenceDirectory } from "./lib/model-evidence.mts";

const local = localEnvironment(process.cwd());
const fixtures = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
const runtime = JSON.parse(readFileSync("backend/tmp/development-runtime/runtime.json", "utf8"));
if (fixtures.fingerprint !== local.fingerprint || fixtures.tag !== "echo-student-consultation-v1" || runtime.fingerprint !== local.fingerprint || runtime.state !== "ready" || runtime.frontend !== "http://127.0.0.1:3000") throw new Error("Ready local runtime required");
const account = fixtures.accounts[0];
const db = createClient(LOCAL_API, local.serviceKey, { auth: { persistSession: false }, global: { fetch: localFetch } });
const actor = await db.auth.admin.getUserById(account.id);
if (actor.error || !actor.data.user) throw new Error("Local fixture unavailable");
assertFixtureUser(actor.data.user, account.email);
if (actor.data.user.app_metadata.consultation_demo !== true) throw new Error("Not a fictional consultation actor");
const evidence = modelEvidenceDirectory("artifacts/model-integration/port3000-runtime-20261030");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ baseURL: runtime.frontend, viewport: { width: 390, height: 1000 }, reducedMotion: "reduce" });
  const requestOrigins = new Set<string>();
  page.on("request", request => { requestOrigins.add(new URL(request.url()).origin); });
  await page.route("**/*", route => [runtime.frontend, runtime.backend, LOCAL_API].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  await page.goto("/login?next=/buddy");
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel(/^Email address/).fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/buddy");
  await page.getByLabel("Message Buddy", { exact: true }).fill("Fictional outage verification: a small calm next step please.");
  const stopped = execFileSync("powershell.exe", ["-NoProfile", "-Command", `
    $runtime = Get-Content backend/tmp/development-runtime/runtime.json -Raw | ConvertFrom-Json
    $ids = @(Get-NetTCPConnection -LocalPort 8100 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($ids.Count -ne 1) { throw 'Unexpected AI listener topology' }
    $entry = Get-CimInstance Win32_Process -Filter "ProcessId=$($ids[0])"
    if ($entry.CommandLine -notmatch 'uvicorn app.main:app.*--port 8100') { throw 'Wrong model process' }
    $cursor = $entry; $owned = $false
    for ($i=0; $i -lt 10 -and $cursor; $i++) {
      if ($cursor.ProcessId -eq $runtime.supervisorPid) { $owned = $true; break }
      $cursor = Get-CimInstance Win32_Process -Filter "ProcessId=$($cursor.ParentProcessId)"
    }
    if (-not $owned) { throw 'AI process is not owned by this supervisor' }
    Stop-Process -Id $ids[0]
    Write-Output $ids[0]
  `], { cwd: process.cwd(), encoding: "utf8", timeout: 10000, windowsHide: true }).trim();
  const send = () => Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/buddy/messages" && r.request().method() === "POST", { timeout: 90000 }), page.getByRole("button", { name: "Send message", exact: true }).click()]);
  const [failure] = await send();
  expect(failure.status()).toBe(503);
  const failedBody = await failure.json();
  await expect(page.getByRole("alert").filter({ hasText: /unavailable/ })).toBeVisible();
  await page.screenshot({ path: `${evidence}/buddy-outage-390.png`, fullPage: true });
  await waitForConsultation(() => fetch(runtime.fastApi + "/openapi.json", { signal: AbortSignal.timeout(1000) }).then(r => r.ok).catch(() => false), 60000, 500);
  await page.getByLabel("Message Buddy", { exact: true }).fill("Fictional service recovery: one small calm next step please.");
  const recoveryStarted = performance.now();
  const [recovery] = await send();
  const recoveryRoundTripMs = Math.round(performance.now() - recoveryStarted);
  expect(recovery.status()).toBe(201);
  const saved = (await recovery.json()).data;
  const reply = saved.messages.at(-1);
  expect(reply.generation.executionState).toBe("REAL_PROVISIONAL_MODEL");
  expect(reply.generation.modelId).toBe("echo-qwen2-cbt-drive-export");
  await page.reload();
  await expect(page.getByText(reply.content, { exact: true })).toBeVisible();
  const messages = await db.schema("buddy_service").from("buddy_messages").select("content").eq("user_id", account.id).eq("conversation_id", saved.conversationId);
  expect(messages.error).toBeNull(); expect(messages.data!.every(row => row.content.startsWith("echo:encrypted:v1:"))).toBe(true);
  await page.screenshot({ path: `${evidence}/buddy-recovered-390.png`, fullPage: true });
  const restartedWrapperPid = Number(execFileSync("powershell.exe", ["-NoProfile", "-Command", `
    $runtime = Get-Content backend/tmp/development-runtime/runtime.json -Raw | ConvertFrom-Json
    $listener = Get-NetTCPConnection -LocalPort 8100 -State Listen | Select-Object -First 1
    $cursor = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    for ($i=0; $i -lt 10 -and $cursor -and $cursor.ParentProcessId -ne $runtime.supervisorPid; $i++) {
      $cursor = Get-CimInstance Win32_Process -Filter "ProcessId=$($cursor.ParentProcessId)"
    }
    $recorded = @($runtime.services | Where-Object name -eq 'ai')[0].pid
    if (-not $cursor -or $cursor.ParentProcessId -ne $runtime.supervisorPid -or $recorded -ne $cursor.ProcessId) { throw 'Restarted AI process status is stale or not owned' }
    Write-Output $cursor.ProcessId
  `], { encoding: "utf8", timeout: 10000, windowsHide: true }).trim());
  expect(restartedWrapperPid).not.toBe(runtime.services.find((s: { name: string }) => s.name === "ai").pid);
  const report = { frontend: runtime.frontend, target: LOCAL_API, fingerprint: local.fingerprint, stoppedOwnedFastApiPid: Number(stopped), restartedWrapperPid, restartPidTrackingVerified: true, offlineStatus: failure.status(), offlineErrorCode: failedBody.error?.code, recoveryStatus: recovery.status(), recoveryRoundTripMs, coldRecoveryStageMs: reply.generation.durationMs, modelId: reply.generation.modelId, modelVersion: reply.generation.modelVersion, executionState: reply.generation.executionState, conversationId: saved.conversationId, restoredAfterRefresh: true, encryptedPersistence: true, supervisorRecoveredAi: true };
  writeFileSync(`${evidence}/outage-recovery.json`, JSON.stringify(report, null, 2));
  expect([...requestOrigins].every(origin => [runtime.frontend, runtime.backend, LOCAL_API].includes(origin))).toBe(true);
  expect(requestOrigins.has(runtime.backend)).toBe(true); expect(requestOrigins.has(LOCAL_API)).toBe(true);
  writeFileSync(`${evidence}/after-runtime.json`, JSON.stringify({ frontend: runtime.frontend, backend: runtime.backend, localSupabase: LOCAL_API, actualBrowserRequestOrigins: [...requestOrigins], sharedOrPort4200Requests: 0, externalRequestsBlocked: true }, null, 2));
  process.stdout.write(JSON.stringify(report) + "\n");
} finally { await browser.close(); }
