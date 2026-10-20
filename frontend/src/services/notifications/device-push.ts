import { env } from "@/config/environment";
import { notificationsService } from "./notifications.service";

export function canUseDevicePush(): boolean {
  return typeof window !== "undefined" && window.isSecureContext &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window &&
    Boolean(env.pushVapidPublicKey);
}

function vapidBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=");
  const decoded = atob(padded);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

export async function enableDevicePush(): Promise<void> {
  if (!canUseDevicePush()) throw new Error("Device alerts need a supported browser and a secure connection.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Allow notifications in your browser to enable device alerts.");
  const registration = await navigator.serviceWorker.register("/echo-push-sw.js", { scope: "/" });
  const subscription = await registration.pushManager.getSubscription() ??
    await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(env.pushVapidPublicKey) });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
    throw new Error("This browser did not provide a complete push subscription.");
  await notificationsService.registerPush({
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

export async function disableDevicePush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try { await notificationsService.unregisterPush(subscription.endpoint); }
  finally { await subscription.unsubscribe(); }
}
