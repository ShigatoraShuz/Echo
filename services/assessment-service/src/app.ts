import { Router } from "express";
import { asyncRoute, createServiceApp, requireGatewayUser, sendData, ServiceError } from "@echo/service-core";
import { z } from "zod";
import { type AssessmentService } from "./assessment.js";
const mood = z.object({
  moodScore: z.number().int().min(1).max(5),
  energyScore: z.number().int().min(1).max(5).optional(),
  anxietyScore: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(2000).optional(),
});
const screening = z.object({ answers: z.array(z.number().int().min(0).max(3)).length(8) });
export function createAssessmentApp(service: AssessmentService, token: string) {
  const router = Router();
  const user = requireGatewayUser(token);
  router.get(
    "/moods",
    user,
    asyncRoute(async (req, res) => sendData(res, await service.listMoods(req.auth!.id), req.requestId)),
  );
  router.post(
    "/moods",
    user,
    asyncRoute(async (req, res) => {
      const parsed = mood.safeParse(req.body);
      if (!parsed.success) throw new ServiceError(400, "VALIDATION_ERROR", "The mood entry is invalid.");
      sendData(res, await service.recordMood(req.auth!.id, parsed.data), req.requestId, 201);
    }),
  );
  router.get(
    "/assessments/phq8/status",
    user,
    asyncRoute(async (req, res) => sendData(res, await service.status(req.auth!.id), req.requestId)),
  );
  router.get(
    "/assessments/phq8/history",
    user,
    asyncRoute(async (req, res) => sendData(res, await service.history(req.auth!.id), req.requestId)),
  );
  router.post(
    "/assessments/phq8",
    user,
    asyncRoute(async (req, res) => {
      const parsed = screening.safeParse(req.body);
      if (!parsed.success)
        throw new ServiceError(400, "VALIDATION_ERROR", "PHQ-8 requires exactly eight answers from 0 to 3.");
      sendData(res, await service.submit(req.auth!.id, parsed.data.answers), req.requestId, 201);
    }),
  );
  return createServiceApp({ name: "assessment-service", router });
}
