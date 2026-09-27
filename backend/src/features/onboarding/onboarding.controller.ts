import type { Request, Response } from "express";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { OnboardingService } from "./onboarding.service.js";
import { z } from "zod";

const consentSchema = z.strictObject({ terms: z.boolean(), privacy: z.boolean(), dataProcessing: z.boolean(), aiInformation: z.boolean(), journalAnalysis: z.boolean() });
const profileSchema = z.strictObject({ preferredName: z.string().trim().min(1).max(80), timezone: z.string().min(1).max(100).optional(), goals: z.string().max(1000).optional(), buddyTone: z.string().max(80).optional(), startingMood: z.string().max(80).optional() });
const setupSchema = z.strictObject({
  genderIdentity: z.enum(["woman", "man", "non_binary", "self_describe", "prefer_not_to_say"]).nullish(),
  genderSelfDescription: z.string().max(80).nullish(),
  pronouns: z.enum(["she_her", "he_him", "they_them", "use_my_name", "self_describe", "prefer_not_to_say"]).nullish(),
  pronounsSelfDescription: z.string().max(80).nullish(),
  theme: z.enum(["light", "dark", "system"]).optional(), notifications: z.boolean().optional(), facialAnalysis: z.boolean().optional(),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError();
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
