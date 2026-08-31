import { Router } from "express";
import { asyncRoute, createServiceApp, requireGatewayUser, requireInternalToken, sendData, ServiceError } from "@echo/service-core";
import { z } from "zod";
import type { JournalService } from "./journal.service.js";

const id = z.string().uuid();
const inputFields = {
  title: z.string().trim().max(200),
  body: z.string().trim().min(1).max(20_000),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]),
  emotions: z.array(z.string().min(1).max(80)).max(20),
  tags: z.array(z.string().min(1).max(80)).max(20),
  privacyStatus: z.enum(["private", "shared"]),
  analysisConsent: z.boolean(),
};
const input = z.object({
  ...inputFields,
  title: inputFields.title.default(""),
  emotions: inputFields.emotions.default([]),
  tags: inputFields.tags.default([]),
  privacyStatus: inputFields.privacyStatus.default("private"),
  analysisConsent: inputFields.analysisConsent.default(false),
});
const patchInput = z.object(inputFields).partial();
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).default(""),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: "dateFrom must be on or before dateTo.",
  path: ["dateFrom"],
});
const normalize = (body: unknown) => {
  if (!body || typeof body !== "object") return body;
  const normalized = { ...(body as Record<string, unknown>) };
  if (!("privacyStatus" in normalized) && "privacy_status" in normalized) normalized.privacyStatus = normalized.privacy_status;
  if (!("analysisConsent" in normalized) && "analysis_consent" in normalized) normalized.analysisConsent = normalized.analysis_consent;
  return normalized;
};
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new ServiceError(400, "VALIDATION_ERROR", "The request is invalid.", { fields: result.error.issues.map((issue) => ({ field: issue.path.join(".") || "form", message: issue.message })) }); return result.data; }

export function createJournalApp(service: JournalService, options: { internalToken: string; allowedOrigin?: string }) {
  const router = Router();
  const user = requireGatewayUser(options.internalToken);
  const internal = requireInternalToken(options.internalToken);
  router.get("/journals", user, asyncRoute(async (req, res) => sendData(res, await service.list(req.auth!.id, parse(listQuery, req.query)), req.requestId)));
  router.post("/journals", user, asyncRoute(async (req, res) => sendData(res, await service.create(req.auth!.id, parse(input, normalize(req.body))), req.requestId, 201)));
  router.get("/journals/draft", user, asyncRoute(async (req, res) => sendData(res, await service.getDraft(req.auth!.id), req.requestId)));
  router.put("/journals/draft", user, asyncRoute(async (req, res) => sendData(res, await service.saveDraft(req.auth!.id, parse(input.extend({ title: z.string().max(200), body: z.string().max(20_000) }), normalize(req.body))), req.requestId)));
  router.delete("/journals/draft", user, asyncRoute(async (req, res) => { await service.deleteDraft(req.auth!.id); res.status(204).end(); }));
  router.get("/journals/:journalId", user, asyncRoute(async (req, res) => sendData(res, await service.get(req.auth!.id, parse(id, req.params.journalId)), req.requestId)));
  router.patch("/journals/:journalId", user, asyncRoute(async (req, res) => sendData(res, await service.update(req.auth!.id, parse(id, req.params.journalId), parse(patchInput, normalize(req.body))), req.requestId)));
  router.delete("/journals/:journalId", user, asyncRoute(async (req, res) => { await service.remove(req.auth!.id, parse(id, req.params.journalId)); res.status(204).end(); }));
  router.get("/internal/journals/:journalId/analysis-input", internal, user, asyncRoute(async (req, res) => sendData(res, await service.analysisInput(req.auth!.id, parse(id, req.params.journalId)), req.requestId)));
  return createServiceApp({ name: "journal-service", router, allowedOrigin: options.allowedOrigin });
}
