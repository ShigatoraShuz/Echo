import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnvironment } from "../../dist/config/environment.js";
import { createSupabaseAdminClient, createSupabaseAccessTokenVerifier } from "../../dist/infrastructure/supabase/supabase-admin.client.js";
import { InAppReminderWorker } from "../../dist/features/notifications/in-app-reminder.worker.js";
import { NotificationChannelWorker } from "../../dist/features/notifications/notification-channel.worker.js";
import { PushSubscriptionsService } from "../../dist/features/notifications/push-subscriptions.service.js";
import { createEncryptionService } from "../../dist/infrastructure/encryption/encryption.service.js";
import { pushPayload } from "../../dist/features/notifications/notification-transports.js";

if (process.env.ECHO_LIVE_REMINDER_QA !== "1") {
  throw new Error("Set ECHO_LIVE_REMINDER_QA=1 to run this disposable-account check.");
}

const environment = loadEnvironment();
const admin = createSupabaseAdminClient(environment);
const publicClient = createClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const worker = new InAppReminderWorker(admin);
const encryption = createEncryptionService(environment.JOURNAL_ENCRYPTION_KEY_BASE64,
  environment.JOURNAL_ENCRYPTION_KEY_VERSION, environment.ENCRYPTION_PREVIOUS_KEYS_JSON);
let temporaryUserId;
let temporaryExternalNoticeId;
let accessToken;

async function api(path, options = {}) {
  const response = await fetch(`${process.env.ECHO_API_BASE_URL ?? "http://127.0.0.1:4200/api/v1"}${path}`, {
    method: options.method ?? "GET",
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Notification API returned ${response.status} (${payload.error?.code ?? "UNKNOWN"}) for ${path}.`);
  return payload.data;
}

function check(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code ?? "DATABASE_UNAVAILABLE"}`);
  return result.data;
}

async function noticeCount() {
  const result = await admin.schema("notification_service").from("notifications")
    .select("id", { count: "exact", head: true }).eq("user_id", temporaryUserId);
  check(result, "Count temporary notices");
  return result.count;
}

try {
  const existing = await admin.schema("user_service").from("notification_preferences")
    .select("user_id", { count: "exact", head: true })
    .eq("in_app_enabled", true).not("reminder_time", "is", null)
    .or("journal_reminders_enabled.eq.true,wellbeing_reminders_enabled.eq.true");
  check(existing, "Check existing reminder recipients");
  if (existing.count !== 0) throw new Error("Live reminder QA requires no other opted-in recipients.");

  const email = `echo-reminder-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString("base64url");
  const account = check(await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  }), "Create temporary account");
  temporaryUserId = account.user?.id;
  if (!temporaryUserId) throw new Error("Temporary account was not created.");
  check(await admin.schema("user_service").from("profiles").upsert({
    user_id: temporaryUserId, display_name: "ECHO reminder QA", account_status: "active",
  }, { onConflict: "user_id" }), "Create temporary active profile");

  const signedIn = check(await publicClient.auth.signInWithPassword({ email, password }), "Sign in temporary account");
  accessToken = signedIn.session?.access_token;
  if (!accessToken) throw new Error("Temporary sign-in returned no access token.");
  if (!await createSupabaseAccessTokenVerifier(admin, environment.SUPABASE_URL).getUser(accessToken)) {
    const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    const active = await admin.schema("user_service").rpc("security_session_active", {
      p_user_id: temporaryUserId, p_session_id: claims.session_id,
    });
    throw new Error(`Temporary session was not accepted: sessionActive=${active.data === true}.`);
  }
  await api("/access/age", { method: "POST", body: { birthday: "1990-01-01" } });
  await api("/onboarding/consent", { method: "POST", body: {
    terms: true, privacy: true, dataProcessing: true, aiInformation: true, journalAnalysis: false,
  } });
  await api("/onboarding/profile", { method: "POST", body: {
    preferredName: "ECHO reminder QA", timezone: "UTC",
  } });
  await api("/onboarding/setup", { method: "POST", body: { notifications: false } });
  await api("/onboarding/complete", { method: "POST" });
  const activePolicies = check(await admin.schema("auth_provisioning").from("policy_documents")
    .select("id").eq("is_active", true), "Read current policies");
  if (activePolicies.length !== 3) throw new Error("Three active policies are required for temporary account setup.");
  await api("/access/policies", { method: "POST", body: {
    reviewedDocumentIds: activePolicies.map((policy) => policy.id),
  } });
  const access = await api("/access/status");
  if (access.decision !== "ACCESS_GRANTED") throw new Error(`Temporary account access decision: ${access.decision}.`);
  const initialSettings = await api("/settings");
  if (initialSettings.notifications.quietHoursAvailable !== true) {
    throw new Error("Notification Settings did not detect the live quiet-hours schema.");
  }

  const preference = {
    emailEnabled: false, pushEnabled: false, inAppEnabled: true,
    journalRemindersEnabled: true, wellbeingRemindersEnabled: true,
    insightNotificationsEnabled: false, reminderTime: "11:30", reminderTimezone: "UTC",
    quietHoursStart: null, quietHoursEnd: null,
  };
  const saved = await api("/settings/notifications", { method: "PATCH", body: preference });
  if (saved.notifications.journalRemindersEnabled !== true || saved.notifications.quietHoursAvailable !== true) {
    throw new Error("Notification preferences did not save through the authenticated API.");
  }

  const today = new Date();
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
  const next = new Date(first.getTime() + 86_400_000);
  const initial = [await worker.tick(first), await worker.tick(first), await noticeCount()];
  if (initial[0] !== 2 || initial[1] !== 0 || initial[2] !== 2) {
    throw new Error(`Due delivery or same-day deduplication failed: ${initial.join("/")}.`);
  }
  const inbox = await api("/notifications?status=all&limit=20");
  if (inbox.notifications.length !== 2 || inbox.unreadCount !== 2) {
    throw new Error("Delivered reminders were not visible in the owner's inbox.");
  }

  await api("/settings/notifications", { method: "PATCH", body: {
    ...preference, quietHoursStart: "11:45", quietHoursEnd: "12:15",
  } });
  if (await worker.tick(next) !== 0 || await noticeCount() !== 2) {
    throw new Error("Quiet hours did not suppress the next day's reminders.");
  }

  await api("/settings/notifications", { method: "PATCH", body: preference });
  if (await worker.tick(next) !== 2 || await worker.tick(next) !== 0 || await noticeCount() !== 4) {
    throw new Error("Delivery did not resume or next-day deduplication failed.");
  }

  const subscription = {
    endpoint: `https://fcm.googleapis.com/fcm/send/echo-qa-${randomUUID()}`,
    keys: { p256dh: randomBytes(65).toString("base64url"), auth: randomBytes(16).toString("base64url") },
  };
  if (process.env.ECHO_LIVE_PUSH_API_QA === "1") {
    await api("/notifications/push/subscriptions", { method: "POST", body: subscription });
  } else {
    await new PushSubscriptionsService(admin, encryption, true).save(temporaryUserId, subscription);
  }
  await api("/settings/notifications", { method: "PATCH", body: {
    ...preference, emailEnabled: true, pushEnabled: true,
  } });
  const createdNotice = check(await admin.schema("notification_service").from("notifications")
    .insert({ user_id: temporaryUserId, notification_type: "journal_reminder",
      title: "A moment to write", message: "Open ECHO privately." })
    .select("id").single(), "Queue temporary external alert");
  temporaryExternalNoticeId = createdNotice.id;
  const attempted = { email: 0, push: 0 };
  const channelWorker = new NotificationChannelWorker(admin, encryption,
    { async send(to, deliveryId) {
      if (to !== email || !deliveryId) throw new Error("Wrong email recipient or delivery ID.");
      attempted.email += 1;
      return "fake-provider-id";
    } },
    async (sentSubscription, type, masked) => {
      if (sentSubscription.endpoint !== subscription.endpoint || type !== "journal_reminder" || masked !== true)
        throw new Error("Push target or masking preference was wrong.");
      if (JSON.parse(pushPayload(type, masked)).title !== "ECHO update") throw new Error("Push title was not masked.");
      attempted.push += 1;
    });
  if (await channelWorker.tick() !== 2 || attempted.email !== 1 || attempted.push !== 1) {
    throw new Error("Queued email and device alerts were not processed once.");
  }
  const delivered = check(await admin.schema("notification_service").from("notification_logs")
    .select("channel,delivery_status").eq("notification_id", createdNotice.id), "Check external delivery records");
  if (delivered.length !== 2 || delivered.some((row) => row.delivery_status !== "sent")) {
    throw new Error("External delivery records were not completed.");
  }
  process.stdout.write("Live notification QA passed: authenticated Settings, inbox, deduplication, quiet hours, and fake-provider email/push delivery with masking.\n");
} finally {
  if (temporaryUserId) {
    const cleanup = await admin.auth.admin.deleteUser(temporaryUserId);
    if (cleanup.error) {
      process.stderr.write(`Temporary account cleanup failed: ${cleanup.error.code ?? "DATABASE_UNAVAILABLE"}\n`);
      process.exitCode = 1;
    } else {
      const subscriptions = await admin.schema("notification_service").from("push_subscriptions")
        .select("id", { count: "exact", head: true }).eq("user_id", temporaryUserId);
      const deliveries = temporaryExternalNoticeId ? await admin.schema("notification_service").from("notification_logs")
        .select("id", { count: "exact", head: true }).eq("notification_id", temporaryExternalNoticeId) : null;
      if (await noticeCount() !== 0 || subscriptions.error || subscriptions.count !== 0 ||
        deliveries?.error || (deliveries && deliveries.count !== 0)) {
        process.stderr.write("Temporary notification records remained after account deletion.\n");
        process.exitCode = 1;
      } else {
        process.stdout.write("Temporary account, notices, subscriptions, and delivery records were removed.\n");
      }
    }
  }
}
