import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import type { EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { DeliveryError } from "./notification-transports.js";
import { NotificationChannelWorker } from "./notification-channel.worker.js";

function fixture(send: (to: string, deliveryId: string) => Promise<string | null>, enabled = true) {
  const updates: Record<string, unknown>[] = [];
  const database = {
    schema: () => ({
      rpc: async () => ({ data: [{ id: "delivery-1", notification_id: "notice-1", user_id: "user-1",
        notification_type: "journal_reminder", channel: "email", push_subscription_id: null,
        claim_token: "lease-1", attempt_count: 1, enabled, lock_screen_private: true }], error: null }),
      from: () => ({
        update: (values: Record<string, unknown>) => {
          updates.push(values);
          return { eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) };
        },
      }),
    }),
    auth: { admin: { getUserById: async () => ({ data: { user: {
      email: "person@example.test", email_confirmed_at: "2026-10-18T00:00:00Z",
    } }, error: null }) } },
  } as unknown as SupabaseClient;
  const worker = new NotificationChannelWorker(database, {} as EncryptionService, { send }, null);
  return { worker, updates };
}

it("sends an opted-in alert and records delivery without message content", async () => {
  const send = vi.fn().mockResolvedValue("provider-1");
  const { worker, updates } = fixture(send);
  expect(await worker.tick()).toBe(1);
  expect(send).toHaveBeenCalledWith("person@example.test", "delivery-1");
  expect(updates[0]).toMatchObject({ delivery_status: "sent", provider_message_id: "provider-1" });
  expect(JSON.stringify(updates)).not.toContain("person@example.test");
});

it("cancels delivery after opt-out and retries transient provider failures", async () => {
  const send = vi.fn().mockRejectedValue(new DeliveryError("email_http_429", true));
  const optedOut = fixture(send, false);
  await optedOut.worker.tick();
  expect(send).not.toHaveBeenCalled();
  expect(optedOut.updates[0].delivery_status).toBe("cancelled");
  const optedIn = fixture(send);
  await optedIn.worker.tick();
  expect(optedIn.updates[0]).toMatchObject({ delivery_status: "pending", failure_code: "email_http_429" });
});
