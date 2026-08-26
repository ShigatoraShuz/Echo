import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/response.js";
import type { SupportResourcesService } from "./support-resources.service.js";

export function createSupportResourcesController(service: SupportResourcesService) {
  return {
    async supportResources(request: Request, response: Response) {
      const query = typeof request.query.q === "string" ? request.query.q.slice(0, 100) : undefined;
      const type = typeof request.query.type === "string" ? request.query.type.slice(0, 80) : undefined;
      sendSuccess(response, await service.supportResources(query, type));
    },
  };
}
