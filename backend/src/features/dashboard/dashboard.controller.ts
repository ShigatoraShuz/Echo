import type { Request, Response } from "express";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { DashboardService } from "./dashboard.service.js";

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

export function createDashboardController(service: DashboardService) {
  return {
    async dashboard(request: Request, response: Response) {
      const range = typeof request.query.range === "string" ? request.query.range : undefined;
      const data = range
        ? await service.dashboard(authenticatedUserId(request), range)
        : await service.dashboard(authenticatedUserId(request));
      sendSuccess(response, data);
    },
  };
}
