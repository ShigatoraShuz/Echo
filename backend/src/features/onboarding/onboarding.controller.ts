import type { Request, Response } from "express";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { OnboardingService } from "./onboarding.service.js";

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
      sendSuccess(response, await service.saveConsent(authenticatedUserId(request), request.body));
    },
    async saveProfile(request: Request, response: Response) {
      sendSuccess(response, await service.saveProfile(authenticatedUserId(request), request.body));
    },
    async saveSetup(request: Request, response: Response) {
      sendSuccess(response, await service.saveSetup(authenticatedUserId(request), request.body));
    },
    async completeOnboarding(request: Request, response: Response) {
      sendSuccess(response, await service.completeOnboarding(authenticatedUserId(request)));
    },
  };
}
