import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { GroundingService } from "./grounding.service.js";

const groundingSchema = z.object({
  technique: z.string().trim().min(1).max(80),
  durationSeconds: z.number().int().min(10).max(3_600),
  pace: z.enum(["gentle", "slower", "steady"]),
});

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError({ fields: result.error.issues.map((issue) => issue.message) });
  }
  return result.data;
}

export function createGroundingController(service: GroundingService) {
  return {
    async completeGrounding(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.completeGrounding(authenticatedUserId(request), parse(groundingSchema, request.body)),
        201,
      );
    },
  };
}
