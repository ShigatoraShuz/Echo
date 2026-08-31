import type { Request, Response } from "express";
import { z } from "zod";
import { journalSubmissionInputSchema } from "@echo/contracts";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { JournalService } from "./journals.service.js";

const journalInputSchema = journalSubmissionInputSchema;

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
const supportResourceSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z
    .string()
    .regex(/^[A-Za-z0-9 -]{1,40}$/)
    .optional(),
});
const supportContactSchema = z.object({ trustedContactId: z.string().uuid(), jobId: z.string().uuid().optional() });
const buddyHandoffSchema = z.object({ analysisResultId: z.string().uuid() });
const safetyReviewSchema = z.object({
  decision: z.enum(["approved_continue", "end_analysis"]),
  decisionKey: z.string().min(16).max(200),
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
      const fixture = request.header("X-ECHO-ANALYSIS-FIXTURE");
      const result = await service.create(
        userId(request),
        parse(journalInputSchema, normalizeJournalPayload(request.body)),
        request.header("Idempotency-Key"),
        fixture,
      );
      if (result.kind === "analysis") return sendSuccess(response, result.submission, 202);
      return sendSuccess(response, { journalId: result.journalId, status: "saved" }, 201);
    },
    async update(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.update(
          userId(request),
          requireUuidParam(request, "journalId"),
          parse(journalUpdateSchema, normalizeJournalPayload(request.body)),
        ),
      );
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
    async status(request: Request, response: Response) {
      sendSuccess(response, await service.getAnalysisStatus(userId(request), requireUuidParam(request, "jobId")));
    },
    async dashboardInsights(request: Request, response: Response) {
      sendSuccess(response, await service.dashboardInsights(userId(request)));
    },
    async supportResources(request: Request, response: Response) {
      const input = parse(supportResourceSchema, request.body);
      sendSuccess(response, await service.resolveSupportResources(input.countryCode, input.regionCode));
    },
    async supportContact(request: Request, response: Response) {
      const input = parse(supportContactSchema, request.body);
      sendSuccess(
        response,
        await service.requestSupportContact(userId(request), input.trustedContactId, input.jobId),
        201,
      );
    },
    async buddyHandoff(request: Request, response: Response) {
      const input = parse(buddyHandoffSchema, request.body);
      sendSuccess(response, await service.createBuddyHandoff(userId(request), input.analysisResultId), 201);
    },
    async getBuddyHandoff(request: Request, response: Response) {
      sendSuccess(response, await service.getBuddyHandoff(userId(request), requireUuidParam(request, "handoffId")));
    },
    async safetyReview(request: Request, response: Response) {
      const input = parse(safetyReviewSchema, request.body);
      sendSuccess(
        response,
        await service.resolveSafetyReview(
          userId(request),
          requireUuidParam(request, "jobId"),
          input.decision,
          input.decisionKey,
        ),
      );
    },
  };
}
