import nodemailer from "nodemailer";
import webPush, { type PushSubscription } from "web-push";
import type { BackendEnvironment } from "../../config/environment.js";

export interface EmailSender {
  send(to: string, deliveryId: string): Promise<string | null>;
}

export function createEmailSender(environment: BackendEnvironment): EmailSender | null {
  if (environment.EMAIL_PROVIDER === "disabled") return null;
  const subject = "You have a new update in ECHO";
  const body = `A new update is waiting in ECHO. Open ${environment.FRONTEND_URL}/dashboard to view it privately.\n\nIf you no longer want email alerts, change your notification settings in ECHO.`;
  if (environment.EMAIL_PROVIDER === "resend") {
    return {
      async send(to, deliveryId) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${environment.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `echo-notification-${deliveryId}`,
          },
          body: JSON.stringify({ from: environment.EMAIL_FROM, to: [to], subject, text: body }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new DeliveryError(`email_http_${response.status}`, response.status >= 500 || response.status === 429);
        const result = await response.json() as { id?: unknown };
        return typeof result.id === "string" ? result.id : null;
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_SECURE === "true",
    requireTLS: environment.SMTP_SECURE !== "true",
    auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return {
    async send(to, deliveryId) {
      const sent = await transport.sendMail({
        from: environment.EMAIL_FROM, to, subject, text: body,
        messageId: `<echo-notification-${deliveryId}@${environment.EMAIL_FROM!.split("@")[1]}>`,
      });
      return sent.messageId ?? null;
    },
  };
}

export class DeliveryError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) { super(code); }
}

export function pushPayload(notificationType: string, privateOnLockScreen: boolean): string {
  const title = privateOnLockScreen ? "ECHO update" : ({
    journal_reminder: "A moment to write",
    grounding_reminder: "A moment to pause",
    verification_status: "Account update in ECHO",
  } as Record<string, string>)[notificationType] ?? "New update in ECHO";
  return JSON.stringify({ title, body: "Open ECHO to view this privately.", url: "/dashboard" });
}

export function createPushSender(environment: BackendEnvironment) {
  if (!environment.PUSH_VAPID_SUBJECT || !environment.PUSH_VAPID_PUBLIC_KEY || !environment.PUSH_VAPID_PRIVATE_KEY) return null;
  const vapidDetails = {
    subject: environment.PUSH_VAPID_SUBJECT,
    publicKey: environment.PUSH_VAPID_PUBLIC_KEY,
    privateKey: environment.PUSH_VAPID_PRIVATE_KEY,
  };
  return async (subscription: PushSubscription, notificationType: string, privateOnLockScreen: boolean) => {
    try {
      await webPush.sendNotification(subscription, pushPayload(notificationType, privateOnLockScreen), {
        TTL: 3_600, vapidDetails,
      });
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode;
      if (status === 404 || status === 410) throw new DeliveryError("push_subscription_expired", false);
      if (typeof status === "number" && status >= 400 && status < 500 && status !== 429)
        throw new DeliveryError(`push_http_${status}`, false);
      throw new DeliveryError("push_unavailable", true);
    }
  };
}
