import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushSubscription } from "web-push";
import type { EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { encryptText } from "../../infrastructure/encryption/encryption.service.js";
import { ConflictError, ExternalServiceError } from "../../shared/errors/app-error.js";

const exactHosts = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);

export function validatePushSubscription(value: PushSubscription): void {
  let url: URL;
  try { url = new URL(value.endpoint); }
  catch { throw new ConflictError("INVALID_PUSH_ENDPOINT", "This device's push subscription is invalid."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
      !(exactHosts.has(host) || (host.endsWith(".notify.windows.com") && host.length > ".notify.windows.com".length)) ||
      value.endpoint.length > 2_048) {
    throw new ConflictError("INVALID_PUSH_ENDPOINT", "This push provider is not supported.");
  }
  for (const [name, length] of [["p256dh", 65], ["auth", 16]] as const) {
    const key = value.keys?.[name];
    if (!key || !/^[A-Za-z0-9_-]+$/.test(key) || Buffer.from(key, "base64url").length !== length) {
      throw new ConflictError("INVALID_PUSH_KEYS", "This device's push subscription is invalid.");
    }
  }
}

export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export class PushSubscriptionsService {
  constructor(private readonly database: SupabaseClient, private readonly encryption: EncryptionService,
    private readonly enabled: boolean) {}

  async save(userId: string, subscription: PushSubscription) {
    if (!this.enabled) throw new ExternalServiceError("PUSH_UNAVAILABLE", "Device alerts are not configured yet.");
    validatePushSubscription(subscription);
    const hash = endpointHash(subscription.endpoint);
    const table = this.database.schema("notification_service").from("push_subscriptions");
    const { count, error: countError } = await table.select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (countError) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "This device could not be registered.");
    const existing = await this.database.schema("notification_service").from("push_subscriptions")
      .select("id,user_id").eq("endpoint_hash", hash).maybeSingle();
    if (existing.error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "This device could not be registered.");
    if (existing.data?.user_id !== userId && (count ?? 0) >= 5)
      throw new ConflictError("DEVICE_LIMIT", "Remove a device before adding another one.");
    const { error } = await this.database.schema("notification_service").from("push_subscriptions")
      .upsert({ user_id: userId, endpoint_hash: hash,
        subscription_ciphertext: encryptText(JSON.stringify(subscription), this.encryption),
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint_hash" });
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "This device could not be registered.");
    return { registered: true };
  }

  async remove(userId: string, endpoint: string) {
    const { error } = await this.database.schema("notification_service").from("push_subscriptions")
      .delete().eq("user_id", userId).eq("endpoint_hash", endpointHash(endpoint));
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "This device could not be removed.");
    return { registered: false };
  }

  async removeAll(userId: string): Promise<void> {
    const { error } = await this.database.schema("notification_service").from("push_subscriptions")
      .delete().eq("user_id", userId);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Device registrations could not be removed.");
  }
}
