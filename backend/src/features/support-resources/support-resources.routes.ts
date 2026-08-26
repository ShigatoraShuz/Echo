import { Router } from "express";
import { createSupportResourcesController } from "./support-resources.controller.js";
import type { SupportResourcesService } from "./support-resources.service.js";

export function createSupportResourcesRouter(service: SupportResourcesService): Router {
  const controller = createSupportResourcesController(service);
  const router = Router();
  // Verified support resources are intentionally public — no authentication required.
  router.get("/support-resources", controller.supportResources);
  return router;
}
