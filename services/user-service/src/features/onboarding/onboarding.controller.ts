import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { OnboardingService } from "./onboarding.service.js";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(100),
  goals: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  buddyTone: z.enum(["gentle", "grounded", "reflective"]).optional(),
  preferredCheckInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  startingMood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]).optional(),
});
const setupSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z.boolean().optional(),
  genderIdentity: z.enum(["woman", "man", "non_binary", "self_describe", "prefer_not_to_say"]).nullable().optional(),
  genderSelfDescription: z.string().trim().max(80).nullable().optional(),
  pronouns: z.enum(["she_her", "he_him", "they_them", "use_my_name", "self_describe", "prefer_not_to_say"]).nullable().optional(),
  pronounsSelfDescription: z.string().trim().max(80).nullable().optional(),
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

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

export function createOnboardingController(service: OnboardingService) {
  return {
    async getStatus(request: Request, response: Response) {
      sendSuccess(response, await service.getStatus(authenticatedUserId(request)));
    },
    async saveProfile(request: Request, response: Response) {
      sendSuccess(response, await service.saveProfile(authenticatedUserId(request), parse(profileSchema, request.body)));
    },
    async saveSetup(request: Request, response: Response) {
      sendSuccess(response, await service.saveSetup(authenticatedUserId(request), parse(setupSchema, request.body)));
    },
    async completeOnboarding(request: Request, response: Response) {
      sendSuccess(response, await service.completeOnboarding(authenticatedUserId(request)));
    },
  };
}

