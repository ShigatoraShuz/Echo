import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { SettingsService } from "./settings.service.js";

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(80),
  timezone: z.string().trim().min(1).max(100),
  themeVariant: z.enum(["echo-calm", "echo-night", "echo-soft", "echo-focus"]),
  themeMode: z.enum(["light", "dark", "system"]),
});

const privacySchema = z.object({
  facialAnalysisEnabled: z.boolean(),
  crisisSupportVisible: z.boolean(),
  lockScreenPrivate: z.boolean(),
});

const notificationSchema = z
  .object({
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    journalRemindersEnabled: z.boolean(),
    wellbeingRemindersEnabled: z.boolean(),
    insightNotificationsEnabled: z.boolean(),
    reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    reminderTimezone: z.string().trim().min(1).max(100).nullable(),
  })
  .refine(
    (value) =>
      (!value.journalRemindersEnabled && !value.wellbeingRemindersEnabled) ||
      Boolean(value.reminderTime && value.reminderTimezone),
    { message: "A reminder time and timezone are required when reminders are enabled." },
  );

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxAvatarBytes = 5 * 1024 * 1024;

const contactSchema = z
  .object({
    contactName: z.string().trim().min(1).max(200),
    contactEmail: z.string().trim().email().max(320).nullable(),
    contactPhone: z.string().trim().min(5).max(40).nullable(),
    relationship: z.string().trim().min(1).max(100),
    isPrimary: z.boolean(),
    permissionAcknowledged: z.literal(true, {
      error: "Confirm that this person agreed to be a trusted contact.",
    }),
  })
  .refine((value) => Boolean(value.contactEmail || value.contactPhone), {
    message: "Add an email address or phone number.",
  });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError({
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "form",
        message: issue.message,
      })),
    });
  }
  return result.data;
}

function userId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

function accessToken(request: Request): string {
  if (!request.auth?.accessToken) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.accessToken;
}

export function createSettingsController(service: SettingsService) {
  return {
    async get(request: Request, response: Response) {
      sendSuccess(response, await service.get(userId(request)));
    },
    async updateProfile(request: Request, response: Response) {
      sendSuccess(response, await service.updateProfile(userId(request), parse(profileSchema, request.body)));
    },
    async uploadAvatar(request: Request, response: Response) {
      const mimeType = String(request.header("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const body = request.body;
      if (!allowedAvatarTypes.has(mimeType)) {
        throw new ValidationError({ avatar: ["Upload a JPEG, PNG, WebP, or GIF image."] });
      }
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new ValidationError({ avatar: ["Choose a profile photo to upload."] });
      }
      if (body.length > maxAvatarBytes) {
        throw new ValidationError({ avatar: ["Profile photo must be no larger than 5 MB."] });
      }
      sendSuccess(response, await service.uploadAvatar(userId(request), {
        contents: body,
        mimeType,
        sizeBytes: body.length,
      }));
    },
    async updatePrivacy(request: Request, response: Response) {
      sendSuccess(response, await service.updatePrivacy(userId(request), parse(privacySchema, request.body)));
    },
    async updateNotifications(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.updateNotifications(userId(request), parse(notificationSchema, request.body)),
      );
    },
    async createContact(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.createContact(userId(request), parse(contactSchema, request.body)),
        201,
      );
    },
    async updateContact(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.updateContact(
          userId(request),
          requireUuidParam(request, "contactId"),
          parse(contactSchema, request.body),
        ),
      );
    },
    async removeContact(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.removeContact(userId(request), requireUuidParam(request, "contactId")),
      );
    },
    async requestExport(request: Request, response: Response) {
      sendSuccess(response, await service.requestExport(userId(request)), 201);
    },
    async requestDeletion(request: Request, response: Response) {
      sendSuccess(response, await service.requestDeletion(userId(request)), 201);
    },
    async cancelDeletion(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.cancelDeletion(userId(request), requireUuidParam(request, "requestId")),
      );
    },
    async changePassword(request: Request, response: Response) {
      const input = parse(changePasswordSchema, request.body);
      sendSuccess(response, await service.changePassword(userId(request), request.auth?.email, {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }));
    },
    async listSecurityAuditEvents(request: Request, response: Response) {
      sendSuccess(response, await service.listSecurityAuditEvents(userId(request), parse(auditQuerySchema, request.query).limit));
    },
    async signOutAllDevices(request: Request, response: Response) {
      sendSuccess(response, await service.signOutAllDevices(userId(request), accessToken(request)));
    },
  };
}

