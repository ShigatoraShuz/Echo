import type { Request, Response } from "express";
import { z } from "zod";
import { journalSubmissionInputSchema, journalSubmissionObjectSchema } from "@echo/contracts";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { JournalService } from "./journals.service.js";

const journalInputSchema = journalSubmissionInputSchema;
const journalListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  query: z.string().trim().max(200).default(""),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, { message: "dateFrom must be before dateTo" });
const analysisInsightsQuerySchema = z
  .object({
    range: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .superRefine((value, context) => {
    if (value.range !== "custom") return;
    if (!value.from) context.addIssue({ code: "custom", path: ["from"], message: "from is required for a custom range" });
    if (!value.to) context.addIssue({ code: "custom", path: ["to"], message: "to is required for a custom range" });
    if (value.from && value.to && value.from > value.to)
      context.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from" });
    if (value.from && value.to && Date.parse(`${value.to}T00:00:00.000Z`) - Date.parse(`${value.from}T00:00:00.000Z`) > 366 * 86_400_000)
      context.addIssue({ code: "custom", path: ["to"], message: "custom ranges cannot exceed 366 days" });
  });

const journalUpdateSchema = journalSubmissionObjectSchema.partial();

const journalDraftSchema = z.strictObject({
  submissionKey: z.string().uuid().optional(),
  title: z.string().trim().max(200).default(""),
  body: z.string().trim().max(20_000).default(""),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]),
  emotions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  privacyStatus: z.enum(["private", "shared"]).default("private"),
  analysisConsent: z.boolean().default(false),
});
const supportResourceSchema = z.strictObject({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z
    .string()
    .regex(/^[A-Za-z0-9 -]{1,40}$/)
    .optional(),
});
const supportContactSchema = z.strictObject({ trustedContactId: z.string().uuid(), jobId: z.string().uuid().optional() });
const buddyHandoffSchema = z.strictObject({ analysisResultId: z.string().uuid() });
const safetyReviewSchema = z.strictObject({
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
    async uploadImage(request: Request, response: Response) {
      if (!Buffer.isBuffer(request.body)) throw new ValidationError({image:["An image file is required."]});
      sendSuccess(response, await service.uploadImage(userId(request),requireUuidParam(request,"journalId"),requireUuidParam(request,"imageId"),request.body,request.header("content-type") ?? ""));
    },
    async uploadDraftImage(request: Request, response: Response) {
      if (!Buffer.isBuffer(request.body)) throw new ValidationError({ image: ["An image file is required."] });
      sendSuccess(response, await service.uploadDraftImage(userId(request), requireUuidParam(request, "imageId"), request.body, request.header("content-type") ?? ""));
    },
    async listDraftImages(request: Request, response: Response) {
      sendSuccess(response, await service.listDraftImages(userId(request)));
    },
    async removeDraftImage(request: Request, response: Response) {
      await service.removeDraftImage(userId(request), requireUuidParam(request, "imageId"));
      response.status(204).end();
    },
    async attachDraftImages(request: Request, response: Response) {
      sendSuccess(response, await service.attachDraftImages(userId(request), requireUuidParam(request, "journalId")));
    },
    async list(request: Request, response: Response) {
      const result = journalListSchema.safeParse(request.query);
      if (!result.success) throw new ValidationError({ query: result.error.issues.map((issue) => issue.message) });
      sendSuccess(response, await service.listPage(userId(request), result.data));
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
      const submissionKey = request.query.submissionKey === undefined ? undefined : parse(z.string().uuid(),request.query.submissionKey);
      await service.deleteDraft(userId(request),submissionKey);
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
      const result = analysisInsightsQuerySchema.safeParse(request.query);
      if (!result.success) throw new ValidationError({ query: result.error.issues.map((issue) => issue.message) });
      sendSuccess(response, await service.dashboardInsights(userId(request), result.data));
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
