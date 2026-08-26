import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { BuddyService } from "./buddy.service.js";

const buddyMessageSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
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

export function createBuddyController(service: BuddyService) {
  return {
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
  };
}
