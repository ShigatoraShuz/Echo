import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushSubscription } from "web-push";
import type { EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { decryptText } from "../../infrastructure/encryption/encryption.service.js";
import { DeliveryError, type EmailSender } from "./notification-transports.js";
import { validatePushSubscription } from "./push-subscriptions.service.js";

interface ClaimedDelivery {
  id: string;
  notification_id: string;
  user_id: string;
  notification_type: string;
  channel: "email" | "push";
  push_subscription_id: string | null;
  claim_token: string;
  attempt_count: number;
  enabled: boolean;
  lock_screen_private: boolean;
}

type PushSender = (subscription: PushSubscription, notificationType: string, privateOnLockScreen: boolean) => Promise<void>;

export class NotificationChannelWorker {
  constructor(private readonly database: SupabaseClient, private readonly encryption: EncryptionService,
    private readonly email: EmailSender | null, private readonly push: PushSender | null) {}

  async tick(): Promise<number> {
    const channels = [this.email ? "email" : null, this.push ? "push" : null].filter((value): value is string => !!value);
    if (channels.length === 0) return 0;
    const claimed = await this.database.schema("notification_service").rpc("claim_notification_deliveries", {
      p_limit: 20, p_channels: channels,
    });
    if (claimed.error) throw new Error(`Delivery claim failed: ${claimed.error.code ?? "DATABASE_UNAVAILABLE"}`);
    const rows = (claimed.data ?? []) as ClaimedDelivery[];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
      while (next < rows.length) {
        const row = rows[next++];
        await this.deliver(row);
      }
    }));
    return rows.length;
  }

  private async finish(row: ClaimedDelivery, status: "sent" | "failed" | "pending" | "cancelled",
    details: { providerMessageId?: string | null; failureCode?: string | null; nextAttemptAt?: string } = {}) {
    const { error } = await this.database.schema("notification_service").from("notification_logs")
      .update({
        delivery_status: status,
        provider_message_id: details.providerMessageId ?? null,
        failure_code: details.failureCode ?? null,
        next_attempt_at: details.nextAttemptAt ?? new Date().toISOString(),
        sent_at: status === "sent" ? new Date().toISOString() : null,
        lease_until: null,
        claim_token: null,
      })
      .eq("id", row.id).eq("claim_token", row.claim_token).eq("delivery_status", "processing");
    if (error) throw new Error(`Delivery status update failed: ${error.code ?? "DATABASE_UNAVAILABLE"}`);
  }

  private async deliver(row: ClaimedDelivery) {
    if (!row.enabled) return this.finish(row, "cancelled");
    let providerMessageId: string | null = null;
    let cancelled = false;
    try {
      if (row.channel === "email") {
        const recipient = await this.database.auth.admin.getUserById(row.user_id);
        const user = recipient.data.user;
        if (recipient.error) throw new DeliveryError("recipient_lookup_failed", true);
        if (!user?.email || !user.email_confirmed_at) cancelled = true;
        else providerMessageId = await this.email!.send(user.email, row.id);
      } else {
        if (!row.push_subscription_id) cancelled = true;
        else {
          const result = await this.database.schema("notification_service").from("push_subscriptions")
            .select("subscription_ciphertext").eq("id", row.push_subscription_id).eq("user_id", row.user_id).maybeSingle();
          if (result.error) throw new DeliveryError("subscription_lookup_failed", true);
          if (!result.data) cancelled = true;
          else {
            const subscription = JSON.parse(decryptText(result.data.subscription_ciphertext, this.encryption)) as PushSubscription;
            try { validatePushSubscription(subscription); }
            catch { throw new DeliveryError("invalid_push_subscription", false); }
            await this.push!(subscription, row.notification_type, row.lock_screen_private);
          }
        }
      }
    } catch (error) {
      const failure = error instanceof DeliveryError ? error : new DeliveryError("delivery_unavailable", true);
      const retry = failure.retryable && row.attempt_count < 5;
      const nextAttemptAt = new Date(Date.now() + Math.min(30, 2 ** row.attempt_count) * 60_000).toISOString();
      await this.finish(row, retry ? "pending" : "failed", {
        failureCode: failure.code, nextAttemptAt,
      });
      if (failure.code === "push_subscription_expired" && row.push_subscription_id) {
        const removed = await this.database.schema("notification_service").from("push_subscriptions")
          .delete().eq("id", row.push_subscription_id).eq("user_id", row.user_id);
        if (removed.error) throw new Error(`Expired subscription cleanup failed: ${removed.error.code ?? "DATABASE_UNAVAILABLE"}`);
      }
      return;
    }
    if (cancelled) return this.finish(row, "cancelled");
    await this.finish(row, "sent", { providerMessageId });
  }
}
