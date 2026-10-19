/* global document, innerWidth, getComputedStyle, location, window, HTMLImageElement */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadQaTarget, verifyQaUserRemoved } from "./qa-target.mjs";

const qaTarget = loadQaTarget();
const environment = qaTarget.environment;
const apiBaseUrl =
  (qaTarget.staging ? qaTarget.apiBase : process.env.ECHO_API_BASE_URL) ??
  `http://127.0.0.1:${environment.PORT || "4200"}/api/v1`;
const webBaseUrl = qaTarget.staging ? qaTarget.webBase : (process.env.ECHO_WEB_BASE_URL ?? "http://localhost:3000");
const admin = createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicClient = createClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let temporaryUserId;
let temporarySecondUserId;
let temporaryVerificationId;

async function api(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: options.method ?? "GET",
    signal: AbortSignal.timeout(20_000),
    headers: {
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${pathname} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body?.data;
}

async function apiFailure(pathname, expectedStatus, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: options.method ?? "GET",
    signal: AbortSignal.timeout(20_000),
    headers: {
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? "GET"} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function apiRaw(pathname, contents, contentType, accessToken) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: "PUT",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: contents,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`PUT ${pathname} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function checkProtectedTextZoom(page, name) {
  for (const [label, route] of [["Settings", "/settings"], ["Journal", "/journal"]]) {
    await page.goto(`${webBaseUrl}${route}`);
    await page.locator("h1:visible").first().waitFor();
    const enlarged = await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      elements: [...document.querySelectorAll("body *")]
        .filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX === "visible")
        .slice(0, 8).map((element) => `${element.tagName}.${String(element.className).slice(0, 60)} (${element.clientWidth}/${element.scrollWidth})`),
    }));
    await enlarged.evaluate((node) => node.remove());
    if (result.overflow > 1) throw new Error(`${name} ${label} overflows by ${result.overflow}px at 200% text size: ${result.elements.join(" | ")}`);
  }
}

async function checkMobileSettings(email, password) {
  const { chromium, webkit, devices } = await import("playwright");
  for (const [name, engine, device] of [
    ["320px Chromium", chromium, { ...devices["Pixel 5"], viewport: { width: 320, height: 700 } }],
    ["iPhone WebKit", webkit, devices["iPhone 13"]],
  ]) {
    if (process.env.ECHO_UI_ENGINE && !name.toLowerCase().includes(process.env.ECHO_UI_ENGINE.toLowerCase())) continue;
    const browser = await engine.launch();
    let page;
    let stage = "sign in";
    try {
      const context = await browser.newContext(device);
      page = await context.newPage();
      page.setDefaultTimeout(45_000);
      page.setDefaultNavigationTimeout(90_000);
      const failedApiRequests = [];
      page.on("response", (response) => {
        if (/\/api\/v1\//.test(new URL(response.url()).pathname) &&
            (response.status() === 429 || response.status() >= 500)) {
          failedApiRequests.push(`${new URL(response.url()).pathname}: ${response.status()}`);
        }
      });
      await page.goto(`${webBaseUrl}/login`);
      await page.getByRole("button", { name: "Use password instead" }).click();
      await page.getByRole("textbox", { name: "Email address" }).fill(email);
      await page.locator("#auth-password").fill(password);
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/dashboard");
      if (process.env.ECHO_UI_ZOOM_ONLY === "1") {
        stage = "check protected routes at 200% text size";
        await checkProtectedTextZoom(page, name);
        await context.close();
        continue;
      }
      stage = "open notification settings";
      await page.goto(`${webBaseUrl}/settings`);
      const sections = page.getByRole("navigation", { name: "Mobile settings sections" });
      await sections.getByRole("link", { name: /^Privacy/ }).click();
      await page.waitForURL((url) => url.pathname === "/settings/privacy");
      await page.getByRole("link", { name: "All settings" }).click();
      await sections.getByRole("link", { name: /^Notifications/ }).click();
      await page.waitForURL((url) => url.pathname === "/settings/notifications");
      await page.getByRole("heading", { name: "Notification preferences" }).waitFor();
      await page.getByRole("note").filter({ hasText: /updates can appear in the app/i }).waitFor();
      await page.getByRole("button", { name: /^Notifications/ }).click();
      await page.getByRole("dialog", { name: "Gentle updates" }).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog", { name: "Gentle updates" }).waitFor({ state: "hidden" });
      for (const [label, route] of [
        ["Profile", "/settings/profile"],
        ["Verification", "/settings/verification"],
        ["Trusted contacts", "/settings/trusted-contacts"],
        ["Security", "/settings/security"],
        ["Data & account", "/settings/export"],
      ]) {
        stage = `open ${label} settings`;
        await page.goto(`${webBaseUrl}/settings`);
        await sections.getByRole("link", { name: new RegExp(`^${label}`) }).click();
        await page.waitForURL((url) => url.pathname === route);
        await page.locator("h1:visible").first().waitFor();
        const settingsOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (settingsOverflow > 1) throw new Error(`${label} settings overflows by ${settingsOverflow}px.`);
      }
      for (const [label, route] of process.env.ECHO_UI_SKIP_ROUTE_SWEEP === "1" ? [] : [
        ["Dashboard", "/dashboard"],
        ["Calendar", "/calendar"],
        ["Insights", "/insights"],
        ["Emotion insights", "/insights/emotion"],
        ["Risk insights", "/insights/risk"],
        ["Facial insights", "/insights/facial"],
        ["Grounding", "/tools/grounding"],
        ["Find help", "/support/find-help"],
        ["Professional support", "/professional-support"],
        ["Professional discovery", "/professional-support/discover"],
        ["Support requests", "/professional-support/requests"],
        ["Support messages", "/professional-support/messages"],
        ["Support appointments", "/professional-support/appointments"],
        ["Support history", "/professional-support/history"],
        ["Buddy", "/buddy"],
        ["Buddy history", "/buddy/history"],
        ["Journal drafts", "/journal/drafts"],
      ]) {
        stage = `open ${label} on a phone`;
        await page.goto(`${webBaseUrl}${route}`);
        await page.locator("h1:visible").first().waitFor();
        const routeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (routeOverflow > 1) throw new Error(`${label} overflows by ${routeOverflow}px.`);
        // The app has a shared per-IP API limiter; a synthetic route sweep must
        // stay below it so this check measures layouts rather than QA traffic.
        await page.waitForTimeout(2_500);
      }
      await page.goto(`${webBaseUrl}/settings/notifications`);
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("dialog", { name: "App navigation" }).getByRole("link", { name: "Journal" }).click();
      await page.waitForURL((url) => url.pathname === "/journal");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) throw new Error(`${name} Journal overflows by ${overflow}px.`);
      stage = "check protected routes at 200% text size";
      await checkProtectedTextZoom(page, name);
      await page.goto(`${webBaseUrl}/journal`);
      stage = "check app page motion";
      if (failedApiRequests.length > 0) throw new Error(`API requests failed during route navigation: ${failedApiRequests.join(", ")}`);
      const pageEntry = page.locator(".echo-app-page-enter");
      const normalAnimation = await pageEntry.evaluate((element) => getComputedStyle(element).animationName);
      if (normalAnimation !== "echo-card-fade") throw new Error(`${name} app page animation is unavailable.`);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const reducedAnimation = await pageEntry.evaluate((element) => getComputedStyle(element).animationName);
      if (reducedAnimation !== "none") throw new Error(`${name} app page motion ignored reduced motion.`);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      if (name === "320px Chromium" || name === "iPhone WebKit") {
        const journalTitle = `Mobile QA reflection ${randomUUID().slice(0, 8)}`;
        stage = "open journal editor";
        await page.locator('a[href="/journal/new"]:visible').first().click();
        await page.getByRole("textbox", { name: "Reflection title" }).fill(journalTitle);
        await page.getByRole("textbox", { name: "Start writing" }).fill("A disposable journal entry for the mobile draft and photo check.");
        stage = "save text draft and return";
        await page.getByRole("link", { name: "All reflections" }).click();
        await page.waitForFunction(() => location.pathname === "/journal", null, { timeout: 12_000 });
        stage = "resume text draft";
        await page.getByRole("link", { name: "Resume a draft" }).click();
        await page.getByRole("link", { name: "Resume draft" }).click();
        await page.getByRole("textbox", { name: "Reflection title" }).waitFor();
        if (await page.getByRole("textbox", { name: "Reflection title" }).inputValue() !== journalTitle) {
          throw new Error("The saved draft title was not restored.");
        }
        await page.getByLabel("Upload journal photos").setInputFiles(path.resolve(process.cwd(), "../frontend/public/landing/growth/growth-reading-01.png"));
        stage = "cancel browser Back with a selected photo";
        await Promise.all([
          page.evaluate(() => window.history.back()),
          page.waitForEvent("dialog").then((dialog) => dialog.dismiss()),
        ]);
        await page.getByRole("img", { name: "growth-reading-01.png" }).waitFor();
        if (new URL(page.url()).pathname !== "/journal/new") throw new Error("Browser Back discarded a selected photo.");
        stage = "confirm selected-photo warning";
        await Promise.all([
          page.getByRole("link", { name: "All reflections" }).click(),
          page.waitForEvent("dialog").then((dialog) => dialog.dismiss()),
        ]);
        if (new URL(page.url()).pathname !== "/journal/new") throw new Error("Declining the photo warning left the editor.");
        stage = "accept browser Back and reopen the text draft";
        await Promise.all([
          page.evaluate(() => window.history.back()),
          page.waitForEvent("dialog").then((dialog) => dialog.accept()),
        ]);
        await page.waitForURL((url) => url.pathname !== "/journal/new");
        await page.goto(`${webBaseUrl}/journal/drafts`);
        await page.getByRole("link", { name: "Resume draft" }).click();
        if (await page.getByRole("textbox", { name: "Reflection title" }).inputValue() !== journalTitle) {
          throw new Error("Browser Back did not preserve the text draft.");
        }
        await page.getByLabel("Upload journal photos").setInputFiles(path.resolve(process.cwd(), "../frontend/public/landing/growth/growth-reading-01.png"));
        stage = "publish reflection with photo";
        await page.getByRole("button", { name: "Save reflection" }).click();
        await page.waitForURL((url) => /^\/journal\/[^/]+$/.test(url.pathname) && url.pathname !== "/journal/new", { timeout: 20_000 })
          .catch(() => { throw new Error(`Reflection did not save${failedApiRequests.length ? `: ${failedApiRequests.join(", ")}` : "."}`); });
        stage = "load saved photo";
        const savedPhoto = page.getByRole("img", { name: "Photo 1 from this reflection" });
        await savedPhoto.waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector('img[alt="Photo 1 from this reflection"]');
          return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
        });
        await page.reload();
        await savedPhoto.waitFor();
        stage = "show photo in journal overview";
        await page.goto(`${webBaseUrl}/journal`);
        await page.getByRole("img", { name: `Preview photo from ${journalTitle}` }).waitFor();
      }
      await context.close();
    } catch (error) {
      throw new Error(`${name} signed-in mobile smoke failed at ${stage} (${page?.url() ?? "before page creation"}): ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser.close();
    }
  }
}

async function run() {
  const suffix = randomUUID();
  const email = `echo.qa.${suffix}@example.invalid`;
  const password = `Echo-QA-${suffix}!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "ECHO QA",
      signup_consent: {
        version: "2026-07-25",
        terms_accepted: true,
        privacy_acknowledged: true,
        data_processing_acknowledged: true,
        ai_feature_acknowledged: true,
        journal_analysis_consent: false,
      },
    },
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("Temporary user was not created.");
  temporaryUserId = created.data.user.id;
  // Admin-created QA identities bypass the public registration draft trigger.
  const qaProfile = await admin.schema("user_service").from("profiles")
    .upsert({ user_id: temporaryUserId, display_name: "ECHO QA", account_status: "active" }, { onConflict: "user_id" });
  if (qaProfile.error) throw qaProfile.error;

  const signedIn = await publicClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Temporary user could not sign in.");
  const accessToken = signedIn.data.session.access_token;
  let verified = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const validation = await admin.auth.getUser(accessToken);
    if (!validation.error && validation.data.user?.id === temporaryUserId) {
      verified = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!verified) throw new Error("Temporary user access token did not become verifiable.");
  const authenticated = { accessToken };
  const checks = [];

  let backendSessionReady = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${apiBaseUrl}/access/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) { backendSessionReady = true; break; }
    if (response.status !== 401) throw new Error(`Temporary user access check returned ${response.status}.`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!backendSessionReady) {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    const session = await admin.schema("user_service").rpc("security_session_active", {
      p_user_id: temporaryUserId, p_session_id: claims.session_id,
    });
    throw new Error(`Temporary user session was not accepted by the backend (issuerMatches=${claims.iss === `${environment.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`}, sessionActive=${session.data === true}, sessionCheckError=${session.error?.code ?? "none"}).`);
  }

  await api("/access/age", { ...authenticated, method: "POST", body: { birthday: "1990-01-01" } });
  await api("/onboarding/consent", {
    ...authenticated, method: "POST",
    body: { terms: true, privacy: true, dataProcessing: true, aiInformation: true, journalAnalysis: false },
  });
  await api("/onboarding/profile", {
    ...authenticated, method: "POST", body: { preferredName: "ECHO QA", timezone: "Asia/Manila" },
  });
  await api("/onboarding/setup", { ...authenticated, method: "POST", body: { notifications: false } });
  await api("/onboarding/complete", { ...authenticated, method: "POST" });
  const activePolicies = await admin.schema("auth_provisioning").from("policy_documents")
    .select("id").eq("is_active", true);
  if (activePolicies.error || activePolicies.data?.length !== 3) throw new Error("Active policy documents were not available.");
  await api("/access/policies", {
    ...authenticated, method: "POST",
    body: { reviewedDocumentIds: activePolicies.data.map((policy) => policy.id) },
  });
  const access = await api("/access/status", authenticated);
  if (access?.decision !== "ACCESS_GRANTED") throw new Error("Temporary user could not finish current access setup.");
  if (process.env.ECHO_UI_SMOKE === "1") {
    await checkMobileSettings(email, password);
    const engines = process.env.ECHO_UI_ENGINE ?? "320px Chromium and iPhone WebKit";
    checks.push(process.env.ECHO_UI_ZOOM_ONLY === "1"
      ? `signed-in Settings and Journal 200% text-size check in ${engines}`
      : `signed-in ${process.env.ECHO_UI_SKIP_ROUTE_SWEEP === "1" ? "focused" : "route"} smoke in ${engines}, app motion normal/reduced, Settings sections, and Journal browser Back/draft/photo/reload/overview`);
  }

  const consentRows = await admin
    .schema("user_service")
    .from("user_consents")
    .select("consent_type, consent_version, accepted, accepted_at")
    .eq("user_id", temporaryUserId)
    .eq("consent_version", "2026-07-25");
  if (consentRows.error) throw consentRows.error;
  const expectedConsents = new Map([
    ["terms_of_use", true],
    ["privacy_policy", true],
    ["data_processing_notice", true],
    ["ai_feature_notice", true],
    ["journal_analysis", false],
  ]);
  if (
    consentRows.data?.length !== expectedConsents.size ||
    consentRows.data.some((consent) =>
      consent.consent_version !== "2026-07-25" ||
      consent.accepted !== expectedConsents.get(consent.consent_type) ||
      (consent.accepted && !consent.accepted_at) ||
      (!consent.accepted && consent.accepted_at),
    )
  ) {
    throw new Error("Versioned signup consent records were not persisted correctly.");
  }
  checks.push("current onboarding and policy access");
  const allConsentRows = await admin.schema("user_service").from("user_consents")
    .select("id", { count: "exact", head: true }).eq("user_id", temporaryUserId);
  if (allConsentRows.error || allConsentRows.count === null) throw new Error("Consent history could not be counted.");
  const initialConsentCount = allConsentRows.count;

  const unauthenticatedDashboard = await apiFailure("/dashboard", 401);
  if (unauthenticatedDashboard?.error?.code !== "AUTHENTICATION_REQUIRED") {
    throw new Error("Unauthenticated dashboard request was not rejected safely.");
  }
  const invalidTokenDashboard = await apiFailure("/dashboard", 401, { accessToken: "invalid.qa.token" });
  if (invalidTokenDashboard?.error?.code !== "INVALID_ACCESS_TOKEN") {
    throw new Error("Invalid access token was not rejected safely.");
  }
  const malformedProfile = await apiFailure("/settings/profile", 400, {
    ...authenticated,
    method: "PATCH",
    body: { displayName: "" },
  });
  if (malformedProfile?.error?.code !== "VALIDATION_ERROR") {
    throw new Error("Malformed authenticated request did not return a validation error.");
  }
  checks.push("auth and validation rejection");

  const corsResponse = await fetch(`${apiBaseUrl}/health`, {
    headers: { Origin: environment.FRONTEND_URL },
  });
  if (corsResponse.headers.get("access-control-allow-origin") !== environment.FRONTEND_URL) {
    throw new Error("Configured frontend origin was not returned by CORS middleware.");
  }
  checks.push("CORS policy");

  const secondEmail = `echo.qa.second.${suffix}@example.invalid`;
  const secondPassword = `Echo-QA-Second-${suffix}!`;
  const secondCreated = await admin.auth.admin.createUser({
    email: secondEmail,
    password: secondPassword,
    email_confirm: true,
    user_metadata: { display_name: "ECHO QA Second" },
  });
  if (secondCreated.error || !secondCreated.data.user) {
    throw secondCreated.error ?? new Error("Second temporary QA user was not created.");
  }
  temporarySecondUserId = secondCreated.data.user.id;
  const secondProfile = await admin.schema("user_service").from("profiles")
    .upsert({ user_id: temporarySecondUserId, display_name: "ECHO QA Second", account_status: "active" }, { onConflict: "user_id" });
  if (secondProfile.error) throw secondProfile.error;
  const ownProfile = await publicClient
    .schema("user_service")
    .from("profiles")
    .select("user_id")
    .eq("user_id", temporaryUserId)
    .maybeSingle();
  const otherProfile = await publicClient
    .schema("user_service")
    .from("profiles")
    .select("user_id")
    .eq("user_id", temporarySecondUserId);
  const deniedConsentDelete = await publicClient
    .schema("user_service")
    .from("user_consents")
    .delete()
    .eq("user_id", temporaryUserId);
  const consentRowsAfterDeniedDelete = await admin
    .schema("user_service")
    .from("user_consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", temporaryUserId);
  if (
    ownProfile.error ||
    ownProfile.data?.user_id !== temporaryUserId ||
    otherProfile.error ||
    otherProfile.data?.length !== 0 ||
    (deniedConsentDelete.error && deniedConsentDelete.error.code !== "42501") ||
    consentRowsAfterDeniedDelete.error ||
    consentRowsAfterDeniedDelete.count !== initialConsentCount
  ) {
    throw new Error(`Row-level security or consent history check failed (ownVisible=${ownProfile.data?.user_id === temporaryUserId}, ownError=${ownProfile.error?.code ?? "none"}, otherRows=${otherProfile.data?.length ?? "null"}, otherError=${otherProfile.error?.code ?? "none"}, deleteError=${deniedConsentDelete.error?.code ?? "none"}, consentCount=${consentRowsAfterDeniedDelete.count}, expected=${initialConsentCount}).`);
  }
  checks.push("two-user RLS isolation and immutable consent history");

  const settings = await api("/settings", authenticated);
  if (!settings?.profile) throw new Error("Settings profile was not returned.");

  const profileSettings = await api("/settings/profile", {
    ...authenticated,
    method: "PATCH",
    body: {
      displayName: "ECHO QA",
      timezone: "Asia/Manila",
      themeVariant: "echo-soft",
      themeMode: "system",
    },
  });
  if (profileSettings?.profile?.displayName !== "ECHO QA") {
    throw new Error("Profile settings were not persisted.");
  }

  const privacySettings = await api("/settings/privacy", {
    ...authenticated,
    method: "PATCH",
    body: {
      facialAnalysisEnabled: false,
      crisisSupportVisible: true,
      lockScreenPrivate: true,
    },
  });
  if (!privacySettings?.privacy?.crisisSupportVisible || !privacySettings?.privacy?.lockScreenPrivate) {
    throw new Error("Privacy settings were not persisted.");
  }

  const notificationSettings = await api("/settings/notifications", {
    ...authenticated,
    method: "PATCH",
    body: {
      emailEnabled: false,
      pushEnabled: false,
      inAppEnabled: true,
      journalRemindersEnabled: true,
      wellbeingRemindersEnabled: false,
      insightNotificationsEnabled: true,
      reminderTime: "20:00",
      reminderTimezone: "Asia/Manila",
    },
  });
  if (
    notificationSettings?.notifications?.reminderTime !== "20:00" ||
    notificationSettings?.notifications?.reminderTimezone !== "Asia/Manila"
  ) {
    throw new Error("Notification settings were not persisted.");
  }

  const createdContactSettings = await api("/settings/trusted-contacts", {
    ...authenticated,
    method: "POST",
    body: {
      contactName: "Temporary QA Contact",
      contactEmail: "trusted.qa@example.invalid",
      contactPhone: null,
      relationship: "Friend",
      isPrimary: true,
      permissionAcknowledged: true,
    },
  });
  const trustedContact = createdContactSettings?.trustedContacts?.find(
    (contact) => contact.contactName === "Temporary QA Contact",
  );
  if (!trustedContact?.id) throw new Error("Trusted contact was not created.");

  const updatedContactSettings = await api(
    `/settings/trusted-contacts/${encodeURIComponent(trustedContact.id)}`,
    {
      ...authenticated,
      method: "PATCH",
      body: {
        contactName: "Updated QA Contact",
        contactEmail: "trusted.qa@example.invalid",
        contactPhone: null,
        relationship: "Friend",
        isPrimary: true,
        permissionAcknowledged: true,
      },
    },
  );
  if (!updatedContactSettings?.trustedContacts?.some((contact) => contact.contactName === "Updated QA Contact")) {
    throw new Error("Trusted contact was not updated.");
  }
  const removedContactSettings = await api(
    `/settings/trusted-contacts/${encodeURIComponent(trustedContact.id)}`,
    { ...authenticated, method: "DELETE" },
  );
  if (removedContactSettings?.trustedContacts?.some((contact) => contact.id === trustedContact.id)) {
    throw new Error("Trusted contact was not removed.");
  }

  const exportSettings = await api("/settings/data-exports", {
    ...authenticated,
    method: "POST",
  });
  if (exportSettings?.status !== "completed") {
    throw new Error("Data export request was not persisted.");
  }

  const deletionSettings = await api("/settings/account-deletion", {
    ...authenticated,
    method: "POST",
  });
  if (deletionSettings?.status !== "pending" || !deletionSettings.id) {
    throw new Error("Account deletion request was not persisted.");
  }
  const cancelledDeletionSettings = await api(
    `/settings/account-deletion/${encodeURIComponent(deletionSettings.id)}/cancel`,
    { ...authenticated, method: "PATCH" },
  );
  if (cancelledDeletionSettings?.status !== "cancelled") {
    throw new Error("Account deletion request was not cancelled.");
  }
  checks.push("all settings actions");

  const savedDraft = await api("/journals/draft", {
    ...authenticated,
    method: "PUT",
    body: {
      title: "Temporary draft",
      body: "Autosave round-trip",
      mood: "calm",
      emotions: [],
      tags: ["qa"],
      privacyStatus: "private",
      analysisConsent: false,
    },
  });
  const loadedDraft = await api("/journals/draft", authenticated);
  if (!savedDraft?.id || loadedDraft?.body !== "Autosave round-trip") {
    throw new Error("Encrypted journal draft autosave failed.");
  }
  await api("/journals/draft", { ...authenticated, method: "DELETE" });
  checks.push("journal draft autosave");

  const createdJournal = await api("/journals", {
    ...authenticated,
    method: "POST",
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      title: "Live integration reflection",
      body: "A temporary encrypted reflection used only for the live integration check.",
      mood: "calm",
      emotions: ["steady"],
      tags: ["qa"],
      privacyStatus: "private",
      analysisConsent: false,
    },
  });
  const journal = createdJournal?.journalId
    ? await api(`/journals/${encodeURIComponent(createdJournal.journalId)}`, authenticated)
    : null;
  if (!journal?.id || !journal.body.includes("temporary encrypted reflection")) {
    throw new Error("Encrypted journal round-trip failed.");
  }
  checks.push("journal create/decrypt");

  const listed = await api("/journals", authenticated);
  if (!listed?.entries?.some((entry) => entry.id === journal.id)) {
    throw new Error("Created journal was not listed.");
  }
  checks.push("journal list");

  const dashboard = await api("/dashboard", authenticated);
  if (!dashboard?.journalEntries?.some((entry) => entry.id === journal.id)) {
    throw new Error("Dashboard did not receive persisted journal data.");
  }
  checks.push("dashboard");

  const blockedBuddy = await apiFailure("/buddy/session", 403, authenticated);
  if (blockedBuddy?.error?.code !== "VERIFICATION_REQUIRED") {
    throw new Error("Unverified Buddy access did not return the verification gate.");
  }
  checks.push("unverified Buddy gate");

  const initialVerification = await api("/verification", authenticated);
  if (initialVerification?.status !== "not_started" || initialVerification?.canAccessAi) {
    throw new Error("Initial verification state was not locked.");
  }
  await api("/verification/application", {
    ...authenticated,
    method: "PUT",
    body: {
      legalName: "ECHO QA",
      dateOfBirth: "1998-05-12",
      phoneNumber: "+639171234567",
      address: {
        line1: "1 Quiet Street",
        line2: null,
        city: "Manila",
        province: "Metro Manila",
        postalCode: "1000",
        countryCode: "PH",
      },
      governmentIdType: "QA test identity",
      governmentIdNumber: "QA-ONLY-123456",
      guardian: null,
      privacyNoticeAccepted: true,
      identityVerificationConsent: true,
      guardianConsent: false,
    },
  });
  const applicationRow = await admin.schema("verification_service").from("identity_verifications")
    .select("id").eq("user_id", temporaryUserId).single();
  if (applicationRow.error || !applicationRow.data?.id) throw new Error("Temporary verification application was not found for cleanup.");
  temporaryVerificationId = applicationRow.data.id;
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await apiRaw(
    "/verification/documents/user_government_id",
    onePixelPng,
    "image/png",
    accessToken,
  );
  const submittedVerification = await api("/verification/submit", {
    ...authenticated,
    method: "POST",
  });
  if (submittedVerification?.status !== "submitted") {
    throw new Error("Verification application was not submitted.");
  }

  checks.push("verification submission; admin review and approved Buddy need an MFA-enabled test account");

  const insights = await api("/insights/emotions", authenticated);
  if (!Array.isArray(insights?.emotionWheel) || !Array.isArray(insights?.moodTrend)) {
    throw new Error("Emotion insights were not aggregated.");
  }
  checks.push("insights");

  const grounding = await api("/grounding/sessions", {
    ...authenticated,
    method: "POST",
    body: { technique: "box-breathing", durationSeconds: 120, pace: "gentle" },
  });
  if (!grounding?.id || grounding.completedSessions < 1) {
    throw new Error("Grounding completion was not recorded.");
  }
  checks.push("grounding history");

  const support = await api("/support-resources");
  if (!support?.some((resource) => resource.name === "NCMH Crisis Hotline")) {
    throw new Error("Verified support directory resource was not returned.");
  }
  checks.push("verified support directory");

  await api(`/journals/${encodeURIComponent(journal.id)}`, {
    ...authenticated,
    method: "DELETE",
  });
  checks.push("journal delete");

  console.info(`Live integration passed: ${checks.join(", ")}.`);
}

try {
  await run();
} finally {
  if (temporaryUserId) {
    if (temporaryVerificationId) {
      const documents = await admin
        .from("verification_documents")
        .select("storage_path")
        .eq("verification_id", temporaryVerificationId);
      const paths = (documents.data ?? []).map((document) => document.storage_path);
      if (paths.length > 0) {
        const storageCleanup = await admin.storage.from("verification-documents").remove(paths);
        if (storageCleanup.error) {
          console.error("Temporary verification document cleanup failed.", storageCleanup.error.message);
        }
      }
      await admin.from("identity_verifications").delete().eq("id", temporaryVerificationId);
    }
    await admin.from("verification_admins").delete().eq("user_id", temporaryUserId);
    const cleanup = await admin.auth.admin.deleteUser(temporaryUserId);
    if (cleanup.error) {
      console.error("Temporary QA user cleanup failed.", cleanup.error.message);
      process.exitCode = 1;
    } else {
      let verified = true;
      if (qaTarget.staging) {
        try { await verifyQaUserRemoved(admin, temporaryUserId); }
        catch (error) { console.error("Temporary QA user cleanup verification failed.", error.message); process.exitCode = 1; verified = false; }
      }
      if (verified) console.info("Temporary QA user and its cascaded test data were removed.");
    }
  }
  if (temporarySecondUserId) {
    const secondCleanup = await admin.auth.admin.deleteUser(temporarySecondUserId);
    if (secondCleanup.error) {
      console.error("Second temporary QA user cleanup failed.", secondCleanup.error.message);
      process.exitCode = 1;
    } else if (qaTarget.staging) {
      try { await verifyQaUserRemoved(admin, temporarySecondUserId); }
      catch (error) { console.error("Second temporary QA user cleanup verification failed.", error.message); process.exitCode = 1; }
    }
  }
}
