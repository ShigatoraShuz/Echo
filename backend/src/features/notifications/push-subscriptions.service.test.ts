import { expect, it } from "vitest";
import { validatePushSubscription, endpointHash } from "./push-subscriptions.service.js";

const keys = {
  p256dh: Buffer.alloc(65, 1).toString("base64url"),
  auth: Buffer.alloc(16, 2).toString("base64url"),
};

it("accepts a real push service origin and rejects arbitrary outbound destinations", () => {
  expect(() => validatePushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/token", keys })).not.toThrow();
  expect(() => validatePushSubscription({ endpoint: "https://127.0.0.1/private", keys })).toThrow();
  expect(() => validatePushSubscription({ endpoint: "https://attacker.example/collect", keys })).toThrow();
  expect(() => validatePushSubscription({ endpoint: "http://fcm.googleapis.com/fcm/send/token", keys })).toThrow();
  expect(() => validatePushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/token", keys: { ...keys, auth: "bad" } })).toThrow();
  expect(endpointHash("https://fcm.googleapis.com/fcm/send/token")).toHaveLength(64);
});
