import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import type { LocalWorkerService } from "./local-worker.service.js";

const workerSchema = z.object({ workerId: z.string().trim().min(1).max(100) });
const healthSchema = workerSchema.extend({
  acceptingJobs: z.boolean(),
  modelStatus: z.string().max(80).optional(),
  modelVersion: z.string().max(120).optional(),
});
const callbackSchema = workerSchema.extend({
  leaseToken: z.string().min(32).max(200),
  payload: z.unknown().refine((value) => value !== undefined, "A callback payload is required."),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError({ fields: result.error.issues.map((issue) => issue.message) });
  return result.data;
}

export function createLocalWorkerRouter(service: LocalWorkerService): Router {
  const router = Router();
  router.use("/internal/ai", (request: Request, _response: Response, next: NextFunction) => {
    try {
      service.authenticate(request.header("Authorization")?.replace(/^Bearer\s+/i, ""));
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get("/internal/ai/protocol-health", async (_request, response) =>
    sendSuccess(response, await service.protocolHealth()),
  );
  router.post("/internal/ai/worker-health", async (request, response) => {
    const input = parse(healthSchema, request.body);
    sendSuccess(
      response,
      await service.reportHealth(input.workerId, input.acceptingJobs, input.modelStatus, input.modelVersion),
    );
  });
  router.post("/internal/ai/jobs/claim", async (request, response) => {
    const input = parse(workerSchema, request.body);
    sendSuccess(response, await service.claim(input.workerId));
  });
  router.post("/internal/ai/jobs/:jobId/heartbeat", async (request, response) => {
    const input = parse(callbackSchema.omit({ payload: true }), request.body);
    sendSuccess(
      response,
      await service.heartbeat(
        requireUuidParam(request, "jobId"),
        input.workerId,
        input.leaseToken,
        request.header("Idempotency-Key"),
      ),
    );
  });
  for (const [path, handler] of [
    ["progress", service.progress.bind(service)],
    ["safety-result", service.safetyResult.bind(service)],
    ["final-result", service.finalResult.bind(service)],
    ["failure", service.failure.bind(service)],
  ] as const) {
    router.post(`/internal/ai/jobs/:jobId/${path}`, async (request, response) => {
      const input = parse(callbackSchema, request.body);
      sendSuccess(
        response,
        await handler(
          requireUuidParam(request, "jobId"),
          input.workerId,
          input.leaseToken,
          request.header("Idempotency-Key"),
          input.payload,
        ),
      );
    });
  }
  return router;
}
