import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { ExperienceService } from "./experience.service.js";

const buddyMessageSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
});

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

export function createExperienceController(service: ExperienceService) {
  return {
    async dashboard(request: Request, response: Response) {
      const range = typeof request.query.range === "string" ? request.query.range : undefined;
      const data = range
        ? await service.dashboard(authenticatedUserId(request), range)
        : await service.dashboard(authenticatedUserId(request));
      sendSuccess(response, data);
    },
    async buddySession(request: Request, response: Response) {
      sendSuccess(response, await service.buddySession(authenticatedUserId(request)));
    },
    async sendBuddyMessage(request: Request, response: Response) {
      const input = parse(buddyMessageSchema, request.body);
      sendSuccess(response, await service.sendBuddyMessage(authenticatedUserId(request), input.content), 201);
    },
    async buddyHistory(request: Request, response: Response) {
      sendSuccess(response, await service.buddyHistory(authenticatedUserId(request)));
    },
    async emotionInsights(request: Request, response: Response) {
      sendSuccess(response, await service.emotionInsights(authenticatedUserId(request)));
    },
    async completeGrounding(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.completeGrounding(authenticatedUserId(request), parse(groundingSchema, request.body)),
        201,
      );
    },
    async supportResources(request: Request, response: Response) {
      const query = typeof request.query.q === "string" ? request.query.q.slice(0, 100) : undefined;
      const type = typeof request.query.type === "string" ? request.query.type.slice(0, 80) : undefined;
      sendSuccess(response, await service.supportResources(query, type));
    },
  };
}
