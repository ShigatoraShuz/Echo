import type { Request, Response } from "express";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { InsightsService } from "./insights.service.js";

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

export function createInsightsController(service: InsightsService) {
  return {
    async emotionInsights(request: Request, response: Response) {
      sendSuccess(response, await service.emotionInsights(authenticatedUserId(request)));
    },
  };
}
