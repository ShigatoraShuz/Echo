import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { JournalService } from "./journals.service.js";

const journalInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]),
  emotions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  privacyStatus: z.enum(["private", "shared"]).default("private"),
  analysisConsent: z.boolean().default(false),
});

const journalUpdateSchema = journalInputSchema.partial();

const journalDraftSchema = z.object({
  title: z.string().trim().max(200).default(""),
  body: z.string().trim().max(20_000).default(""),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]),
  emotions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  privacyStatus: z.enum(["private", "shared"]).default("private"),
  analysisConsent: z.boolean().default(false),
});

function userId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError({ body: result.error.issues.map((issue) => issue.message) });
  return result.data;
}

function normalizeJournalPayload(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = input as Record<string, unknown>;
  return {
    ...value,
    privacyStatus: value.privacyStatus ?? value.privacy_status,
    analysisConsent: value.analysisConsent ?? value.analysis_consent,
  };
}

export function createJournalsController(service: JournalService) {
  return {
    async list(request: Request, response: Response) {
      sendSuccess(response, { entries: await service.list(userId(request)) });
    },
    async get(request: Request, response: Response) {
      sendSuccess(response, await service.get(userId(request), requireUuidParam(request, "journalId")));
    },
    async create(request: Request, response: Response) {
      sendSuccess(response, await service.create(userId(request), parse(journalInputSchema, normalizeJournalPayload(request.body))), 201);
    },
    async update(request: Request, response: Response) {
      sendSuccess(response, await service.update(userId(request), requireUuidParam(request, "journalId"), parse(journalUpdateSchema, normalizeJournalPayload(request.body))));
    },
    async remove(request: Request, response: Response) {
      await service.remove(userId(request), requireUuidParam(request, "journalId"));
      response.status(204).end();
    },
    async saveDraft(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.saveDraft(userId(request), parse(journalDraftSchema, normalizeJournalPayload(request.body))),
      );
    },
    async getDraft(request: Request, response: Response) {
      sendSuccess(response, await service.getDraft(userId(request)));
    },
    async deleteDraft(request: Request, response: Response) {
      await service.deleteDraft(userId(request));
      response.status(204).end();
    },
    async analyze(request: Request, response: Response) {
      sendSuccess(response, await service.analyze(userId(request), requireUuidParam(request, "journalId")), 201);
    },
    async analyses(request: Request, response: Response) {
      sendSuccess(response, await service.getLatestAnalysis(userId(request), requireUuidParam(request, "journalId")));
    },
  };
}
