import { Router } from "express";
import { asyncRoute, createServiceApp, requireGatewayUser, requireInternalToken, sendData, ServiceError } from "@echo/service-core";
import { z } from "zod";
import type { RecommendationService } from "./recommendation.service.js";

const schema = z.object({
  severity: z.enum(["minimal", "mild", "moderate", "moderately_severe", "severe"]),
  urgentLanguageDetected: z.boolean(),
});

export function createRecommendationApp(service: RecommendationService, token: string) {
  const router = Router();
  const handler = asyncRoute(async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ServiceError(400, "VALIDATION_ERROR", "Recommendation input is invalid.");
    sendData(res, await service.create(parsed.data), req.requestId);
  });
  router.post("/recommendations", requireGatewayUser(token), handler);
  router.post("/internal/recommendations", requireInternalToken(token), handler);
  return createServiceApp({ name: "recommendation-service", router });
}
