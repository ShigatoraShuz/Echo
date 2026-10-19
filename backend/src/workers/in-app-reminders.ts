import { loadEnvironment } from "../config/environment.js";
import { createSupabaseAdminClient } from "../infrastructure/supabase/supabase-admin.client.js";
import { InAppReminderWorker } from "../features/notifications/in-app-reminder.worker.js";
import { NotificationChannelWorker } from "../features/notifications/notification-channel.worker.js";
import { createEmailSender, createPushSender } from "../features/notifications/notification-transports.js";
import { createEncryptionService } from "../infrastructure/encryption/encryption.service.js";
import { setTimeout as sleep } from "node:timers/promises";

const environment = loadEnvironment();
const database = createSupabaseAdminClient(environment);
const worker = new InAppReminderWorker(database);
const channels = new NotificationChannelWorker(database,
  createEncryptionService(environment.JOURNAL_ENCRYPTION_KEY_BASE64,
    environment.JOURNAL_ENCRYPTION_KEY_VERSION, environment.ENCRYPTION_PREVIOUS_KEYS_JSON),
  createEmailSender(environment), createPushSender(environment));
const shutdown = new AbortController();
process.once("SIGINT", () => shutdown.abort());
process.once("SIGTERM", () => shutdown.abort());

async function main() {
  let ticks = 0;
  process.stdout.write(`${JSON.stringify({ service: "notification-delivery", event: "started" })}\n`);
  while (!shutdown.signal.aborted) {
    try {
      const inserted = await worker.tick();
      const processed = await channels.tick();
      if (inserted > 0 || processed > 0 || ticks % 60 === 0) {
        process.stdout.write(`${JSON.stringify({ service: "notification-delivery", event: "heartbeat", inserted, processed })}\n`);
      }
    }
    catch { process.stderr.write(`${JSON.stringify({ service: "notification-delivery", event: "delivery_unavailable" })}\n`); }
    ticks += 1;
    try { await sleep(60_000, undefined, { signal: shutdown.signal }); }
    catch { if (!shutdown.signal.aborted) throw new Error("Reminder worker sleep failed."); }
  }
}

void main();
