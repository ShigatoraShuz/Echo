import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function readEnvironment() {
  const filePath = path.resolve(process.cwd(), ".env");
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

const environment = readEnvironment();
const apiBaseUrl =
  process.env.ECHO_API_BASE_URL ??
  `http://127.0.0.1:${environment.PORT || "4000"}/api/v1`;
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
    headers: {
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

  const consentRows = await admin
    .from("user_consents")
    .select("consent_type, consent_version, accepted, accepted_at")
    .eq("user_id", temporaryUserId);
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
  checks.push("versioned signup consent");

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
  const ownProfile = await publicClient.from("profiles").select("id").eq("id", temporaryUserId).maybeSingle();
  const otherProfile = await publicClient.from("profiles").select("id").eq("id", temporarySecondUserId);
  const deniedConsentDelete = await publicClient.from("user_consents").delete().eq("user_id", temporaryUserId);
  if (
    ownProfile.error ||
    ownProfile.data?.id !== temporaryUserId ||
    otherProfile.error ||
    otherProfile.data?.length !== 0 ||
    !deniedConsentDelete.error
  ) {
    throw new Error("Row-level security or consent history protection did not isolate the QA user.");
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
  if (exportSettings?.latestExport?.status !== "requested") {
    throw new Error("Data export request was not persisted.");
  }

  const deletionSettings = await api("/settings/account-deletion", {
    ...authenticated,
    method: "POST",
  });
  if (deletionSettings?.deletionRequest?.status !== "pending" || !deletionSettings.deletionRequest.id) {
    throw new Error("Account deletion request was not persisted.");
  }
  const cancelledDeletionSettings = await api(
    `/settings/account-deletion/${encodeURIComponent(deletionSettings.deletionRequest.id)}/cancel`,
    { ...authenticated, method: "PATCH" },
  );
  if (cancelledDeletionSettings?.deletionRequest?.status !== "cancelled") {
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
      privacy_status: "private",
      analysis_consent: false,
    },
  });
  const loadedDraft = await api("/journals/draft", authenticated);
  if (!savedDraft?.id || loadedDraft?.body !== "Autosave round-trip") {
    throw new Error("Encrypted journal draft autosave failed.");
  }
  await api("/journals/draft", { ...authenticated, method: "DELETE" });
  checks.push("journal draft autosave");

  const journal = await api("/journals", {
    ...authenticated,
    method: "POST",
    body: {
      title: "Live integration reflection",
      body: "A temporary encrypted reflection used only for the live integration check.",
      mood: "calm",
      emotions: ["steady"],
      tags: ["qa"],
      privacy_status: "private",
      analysis_consent: false,
    },
  });
  if (!journal?.id || journal.body.indexOf("temporary encrypted reflection") === -1) {
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

  const adminGrant = await admin.from("verification_admins").insert({
    user_id: temporaryUserId,
    is_active: true,
  });
  if (adminGrant.error) throw adminGrant.error;
  const queue = await api("/admin/verifications?status=submitted", authenticated);
  const queuedApplication = queue.find((item) => item.userId === temporaryUserId);
  if (!queuedApplication?.id) throw new Error("Submitted verification did not appear in the admin queue.");
  temporaryVerificationId = queuedApplication.id;
  await api(`/admin/verifications/${encodeURIComponent(queuedApplication.id)}/claim`, {
    ...authenticated,
    method: "POST",
  });
  await api(`/admin/verifications/${encodeURIComponent(queuedApplication.id)}/decision`, {
    ...authenticated,
    method: "POST",
    body: {
      decision: "approved",
      reasonCode: "qa_identity_confirmed",
      note: "Automated live-integration approval.",
    },
  });
  const approvedVerification = await api("/verification", authenticated);
  if (approvedVerification?.status !== "approved" || !approvedVerification?.canAccessAi) {
    throw new Error("Approved verification did not unlock AI-supported features.");
  }
  checks.push("verification submission and admin approval");

  const buddy = await api("/buddy/session", authenticated);
  if (!buddy?.conversationId) throw new Error("Buddy session was not created.");
  const buddyReply = await api("/buddy/messages", {
    ...authenticated,
    method: "POST",
    body: { content: "I feel a little overwhelmed today." },
  });
  if (!buddyReply?.messages?.some((message) => message.role === "buddy")) {
    throw new Error("Buddy response was not persisted and returned.");
  }
  checks.push("buddy encrypted conversation");

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
      console.info("Temporary QA user and its cascaded test data were removed.");
    }
  }
  if (temporarySecondUserId) {
    const secondCleanup = await admin.auth.admin.deleteUser(temporarySecondUserId);
    if (secondCleanup.error) {
      console.error("Second temporary QA user cleanup failed.", secondCleanup.error.message);
      process.exitCode = 1;
    }
  }
}
