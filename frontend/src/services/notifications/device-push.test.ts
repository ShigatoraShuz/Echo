import { afterEach, expect, it, vi } from "vitest";
import { env } from "@/config/environment";
import { notificationsService } from "./notifications.service";
import { enableDevicePush } from "./device-push";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  env.pushVapidPublicKey = "";
});

it("asks on a user action, registers the service worker, and saves this device", async () => {
  env.pushVapidPublicKey = Buffer.alloc(65, 1).toString("base64url");
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/test", expirationTime: null,
      keys: { p256dh: "public", auth: "secret" } }),
  };
  const subscribe = vi.fn().mockResolvedValue(subscription);
  const register = vi.fn().mockResolvedValue({ pushManager: {
    getSubscription: async () => null, subscribe,
  } });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
  vi.stubGlobal("PushManager", class {});
  const requestPermission = vi.fn().mockResolvedValue("granted");
  vi.stubGlobal("Notification", { requestPermission });
  const saved = vi.spyOn(notificationsService, "registerPush").mockResolvedValue({ registered: true });

  await enableDevicePush();
  expect(requestPermission).toHaveBeenCalledOnce();
  expect(register).toHaveBeenCalledWith("/echo-push-sw.js", { scope: "/" });
  expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  expect(saved).toHaveBeenCalledWith(subscription.toJSON());
});
