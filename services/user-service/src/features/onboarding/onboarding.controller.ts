import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { OnboardingService } from "./onboarding.service.js";

const consentSchema = z.object({
  terms: z.literal(true),
  privacy: z.literal(true),
  dataProcessing: z.literal(true),
  aiInformation: z.boolean(),
  journalAnalysis: z.boolean(),
});
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  timezone: z.string().trim().min(1).max(100),
  goals: z.string().trim().max(500).optional(),
  buddyTone: z.string().trim().max(80).optional(),
  startingMood: z.string().trim().max(80).optional(),
});
const setupSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z.boolean().optional(),
  facialAnalysis: z.boolean().optional(),
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
    async saveConsent(request: Request, response: Response) {
      sendSuccess(response, await service.saveConsent(authenticatedUserId(request), parse(consentSchema, request.body)));
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

