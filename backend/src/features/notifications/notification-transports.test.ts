import { afterEach, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import type { BackendEnvironment } from "../../config/environment.js";
import { createEmailSender, pushPayload } from "./notification-transports.js";

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("sends only a generic email and reuses the delivery ID for provider retries", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "provider-1" }) });
  vi.stubGlobal("fetch", fetcher);
  const environment = {
    EMAIL_PROVIDER: "resend", EMAIL_FROM: "alerts@example.test", RESEND_API_KEY: "private-key",
    FRONTEND_URL: "https://echo.example.test",
  } as BackendEnvironment;
  const sender = createEmailSender(environment);
  expect(await sender?.send("person@example.test", "delivery-1")).toBe("provider-1");
  const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
  const content = JSON.parse(request.body as string) as { subject: string; text: string };
  expect(content.subject).toBe("You have a new update in ECHO");
  expect(content.text).toContain("https://echo.example.test/dashboard");
  expect(content.text).not.toContain("journal entry");
  expect((request.headers as Record<string, string>)["Idempotency-Key"]).toBe("echo-notification-delivery-1");
});

it("masks device titles by default and never places private content in payloads", () => {
  expect(JSON.parse(pushPayload("journal_reminder", true))).toEqual({
    title: "ECHO update", body: "Open ECHO to view this privately.", url: "/dashboard",
  });
  expect(JSON.parse(pushPayload("journal_reminder", false)).title).toBe("A moment to write");
  expect(JSON.parse(pushPayload("unexpected_private_text", false)).title).toBe("New update in ECHO");
});

it("uses authenticated SMTP with a stable message ID and generic body", async () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "accepted" });
  vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
  const sender = createEmailSender({ EMAIL_PROVIDER: "smtp", EMAIL_FROM: "alerts@example.test",
    SMTP_HOST: "smtp.example.test", SMTP_PORT: 587, SMTP_SECURE: "false",
    SMTP_USER: "sender", SMTP_PASSWORD: "private-password", FRONTEND_URL: "https://echo.example.test",
  } as BackendEnvironment);
  expect(await sender?.send("person@example.test", "delivery-2")).toBe("accepted");
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
    host: "smtp.example.test", requireTLS: true,
  }));
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
    to: "person@example.test", messageId: "<echo-notification-delivery-2@example.test>",
    subject: "You have a new update in ECHO",
  }));
});
