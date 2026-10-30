import { consultationOrigin } from "./lib/consultation-origin.mts";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { localEnvironment, localFetch, LOCAL_API, assertFixtureUser } from "./lib/professional-local-target.mts";

const target = localEnvironment(process.cwd()), fixtures = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (fixtures.fingerprint !== target.fingerprint || fixtures.tag !== "echo-student-consultation-v1") throw new Error("Fixture mismatch");
const account = fixtures.accounts[0];
const auth = createClient(LOCAL_API, target.anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } });
const login = await auth.auth.signInWithPassword({ email: account.email, password: account.password });
if (login.error || !login.data.session) throw new Error("Local fixture login failed");
assertFixtureUser(login.data.user!, account.email);
const api = async (path: string, body?: unknown) => {
  const response = await fetch(`http://127.0.0.1:4300/api/v1${path}`, { method: body ? "PATCH" : "GET", redirect: "error",
    headers: { Authorization: `Bearer ${login.data.session!.access_token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  expect(response.status).toBe(200); return (await response.json()).data;
};
const privacy = (await api("/settings")).privacy;
const payload = { journalAiAnalysisEnabled: privacy.journalAiAnalysisEnabled, buddyHistoryEnabled: privacy.buddyHistoryEnabled,
  facialAnalysisEnabled: privacy.facialAnalysisEnabled, crisisSupportVisible: privacy.crisisSupportVisible, lockScreenPrivate: privacy.lockScreenPrivate };
localEnvironment(process.cwd()); await api("/settings/privacy", { ...payload, facialAnalysisEnabled: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({ baseURL: consultationOrigin(), viewport: { width: 390, height: 1000 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => { throw new DOMException("Synthetic permission denial", "NotAllowedError"); } });
  });
  const page = await context.newPage();
  const mediaRequests: string[] = [];
  page.on("request", request => { if (/face-captures|facial-media/.test(new URL(request.url()).pathname)) mediaRequests.push(request.method()); });
  await page.goto("/login?next=/journal/new"); await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel(/^Email address/).fill(account.email); await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click(); await page.waitForURL(u => !u.pathname.includes("login"));
  await page.getByText("More options", { exact: true }).click(); await page.getByLabel("Allow a reflective summary after saving").check();
  await expect(page.getByText(/UNAVAILABLE: automated emotion inference/)).toBeVisible();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText("Camera permission was denied", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeEnabled();
  expect(mediaRequests).toEqual([]);
  const evidence = "artifacts/model-integration/student-completion-20261030";
  await page.screenshot({ path: `${evidence}/camera-denial-390.png`, fullPage: true });
  writeFileSync(`${evidence}/camera-results.json`, JSON.stringify({ width: 390, permissionDenialVisible: true, retryEnabled: true, inferenceUnavailable: true, faceMediaUploadRequests: mediaRequests.length, realCameraNotAccessed: true }, null, 2));
  process.stdout.write("Mobile camera permission-denial workflow passed; no real camera or facial-media upload.\n");
} finally {
  await browser.close(); localEnvironment(process.cwd()); await api("/settings/privacy", payload);
  await auth.auth.signOut({ scope: "local" });
}
