/** Explicit opt-in real Next/Express/Supabase journey. Not part of the mocked Vite suite. */
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FIXTURE_TAG, localEnvironment, localFetch } from "../../backend/scripts/lib/professional-local-target.mts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const privateDir = new URL("../../backend/tmp/professional-fixtures/", import.meta.url);
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")].map((c) => {
    const index = alphabet.indexOf(c); if (index < 0) throw new Error("Invalid local authenticator material.");
    return index.toString(2).padStart(5, "0");
  }).join("");
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const time = Buffer.alloc(8); time.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = createHmac("sha1", bytes).update(time).digest();
  return ((hmac.readUInt32BE(hmac[19] & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
let phase = "local preflight";
async function main() {
  const local = localEnvironment(root);
  const fixture = JSON.parse(await readFile(new URL("state.json", privateDir), "utf8"));
  if (fixture.tag !== FIXTURE_TAG || fixture.fingerprint !== local.fingerprint || fixture.retired || !local.mfaEnabled) throw new Error("Local prerequisites unavailable.");
  const mfaPath = new URL("mfa.json", privateDir);
  let factors: Record<string, { id: string; secret: string }> = {};
  try { factors = JSON.parse(await readFile(mfaPath, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const account = fixture.accounts["approved-a"];
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
  // No route fulfills, session injection, fake claims, preview or API doubles.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["http://127.0.0.1:3000", "http://127.0.0.1:4200", "http://127.0.0.1:54321"].includes(url.origin) ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message.replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]")));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes('Image with src "data:')) { pageErrors.push("Authenticator image data URL rejected by Next Image."); return; }
    pageErrors.push(message.text().replace(/data:[^\s]+/g, "[data omitted]").replace(/[A-Za-z0-9_+/=-]{32,}/g, "[redacted]").slice(0, 500));
  });
  let token = "";
  let enrollmentSave: Promise<void> | undefined;
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (url.origin !== "http://127.0.0.1:54321" || !response.ok()) return;
    if (url.pathname === "/auth/v1/factors" && response.request().method() === "POST") {
      enrollmentSave = response.json().then(async (body) => {
        if (body.totp?.secret && body.id) {
          factors[account.id] = { id: body.id, secret: body.totp.secret };
          await writeFile(mfaPath, JSON.stringify(factors, null, 2) + "\n", { mode: 0o600 });
        }
      });
    }
    if (/\/auth\/v1\/factors\/[^/]+\/verify$/.test(url.pathname)) {
      token = (await response.json()).access_token ?? "";
    }
  });
  try {
    phase = "actual Next login";
    await page.goto("http://127.0.0.1:3000/professional/login", { waitUntil: "domcontentloaded", timeout: 120_000 });
    const entrance = page.getByText(/Tap anywhere.*to enter ECHO/s);
    await expect(entrance.or(page.getByRole("heading", { name: "Professional sign in", exact: true })).first()).toBeVisible({ timeout: 30_000 });
    if (await entrance.isVisible()) await entrance.click();
    await expect(page.getByRole("heading", { name: "Professional sign in", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Password", exact: true }).click();
    await page.getByRole("textbox", { name: /^Email address/ }).fill("approved-a@professional.echo.test");
    await page.locator('input[type="password"]').fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    phase = "real MFA enrollment/challenge";
    await expect(page.getByLabel("Authenticator code", { exact: true })).toBeVisible({ timeout: 90_000 });
    await enrollmentSave;
    if (!factors[account.id]) throw new Error("Existing authenticator requires its owner's code; no factor will be removed.");
    const dashboardResponse = page.waitForResponse((response) => response.url() === `http://127.0.0.1:4200/api/v1/professional/organizations/${fixture.organizations.a}/dashboard` && response.request().method() === "GET", { timeout: 90_000 });
    await page.getByLabel("Authenticator code", { exact: true }).fill(totp(factors[account.id].secret));
    await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
    phase = "approved organization and real dashboard";
    const dashboard = await dashboardResponse;
    expect(dashboard.status()).toBe(200);
    const payload = await dashboard.json();
    expect(payload.data.organizationId).toBe(fixture.organizations.a);
    await expect(page.getByRole("heading", { name: "Today, at a glance", exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/professional\\?organization=${fixture.organizations.a}`));
    expect(token).not.toBe("");
    phase = "real backend tenant denial";
    const denied = await fetch(`http://127.0.0.1:4200/api/v1/professional/organizations/${fixture.organizations.b}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }, redirect: "error",
    });
    expect(denied.status).toBe(403);
    const memberships = await fetch("http://127.0.0.1:4200/api/v1/professional/me", {
      headers: { Authorization: `Bearer ${token}` }, redirect: "error",
    });
    expect(memberships.status).toBe(200);
    const membership = (await memberships.json()).data;
    expect(membership.mfaRequired).toBe(false);
    expect(membership.memberships.some((item: { organizationId: string; status: string }) => item.organizationId === fixture.organizations.a && item.status === "active")).toBe(true);
    phase = "pending and suspended real HTTP states";
    for (const name of ["pending", "suspended"]) {
      const auth = createClient("http://127.0.0.1:54321", local.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: localFetch },
      });
      const login = await auth.auth.signInWithPassword({ email: `${name}@professional.echo.test`, password: fixture.accounts[name].password });
      expect(login.error).toBeNull();
      try {
        const headers = { Authorization: `Bearer ${login.data.session!.access_token}` };
        const result = await fetch("http://127.0.0.1:4200/api/v1/professional/me", { headers, redirect: "error" });
        expect(result.status).toBe(200);
        const state = (await result.json()).data;
        expect(state.memberships[0].status).toBe(name);
        expect(state.memberships[0].accessState).toBe(`${name}_membership`);
        const dashboard = await fetch(`http://127.0.0.1:4200/api/v1/professional/organizations/${fixture.organizations.a}/dashboard`, { headers, redirect: "error" });
        expect(dashboard.status).toBe(403);
      } finally { await auth.auth.signOut({ scope: "local" }); }
    }
    process.stdout.write("PASS real browser: password login, genuine TOTP/AAL2, approved organization, real scoped dashboard HTTP 200, cross-organization HTTP 403.\n");
    process.stdout.write("PASS real HTTP: pending/suspended membership states preserved; their AAL1 dashboard requests denied.\n");
  } catch (error) {
    const headings = await page.getByRole("heading").allTextContents().catch(() => []);
    const alerts = await page.getByRole("alert").allTextContents().catch(() => []);
    const reason = error instanceof Error ? error.message.replaceAll(account.password, "[redacted]").replace(/[A-Za-z0-9_+/=-]{32,}/g, "[redacted]").split("\n").slice(0, 3).join(" ") : "Unknown failure";
    process.stderr.write(JSON.stringify({ phase, reason, headings, alerts, pageErrors }) + "\n");
    throw error;
  } finally { await context.close(); await browser.close(); }
}
main().catch(() => { process.stderr.write(`FAILED at ${phase}; private credentials and browser diagnostics suppressed.\n`); process.exitCode = 1; });
