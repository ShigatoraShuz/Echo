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
}).partial();

const privacySchema = z.object({
  journalAiAnalysisEnabled: z.boolean(),
  crisisSupportVisible: z.boolean(),
  lockScreenPrivate: z.boolean(),
}).partial();

const notificationSchema = z.object({
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    journalRemindersEnabled: z.boolean(),
    wellbeingRemindersEnabled: z.boolean(),
    insightNotificationsEnabled: z.boolean(),
    reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    reminderTimezone: z.string().trim().min(1).max(100).nullable(),
  }).partial();

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

export function createSettingsController(service: SettingsService) {
  return {
    async get(request: Request, response: Response) {
      sendSuccess(response, await service.get(userId(request)));
    },
    async updateProfile(request: Request, response: Response) {
      sendSuccess(response, await service.updateProfile(userId(request), parse(profileSchema, request.body)));
    },
    async uploadAvatar(request: Request, response: Response) {
      if (!Buffer.isBuffer(request.body)) {
        throw new ValidationError({ avatar: ["Upload a JPEG, PNG, WebP, or GIF image."] });
      }
      sendSuccess(
        response,
        await service.uploadAvatar(userId(request), request.header("content-type") ?? "", request.body),
      );
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
  };
}


