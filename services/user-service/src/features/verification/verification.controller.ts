import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { documentKinds, type VerificationService } from "./verification.service.js";

const addressSchema = z.object({
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).nullable().default(null),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(20),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
});

const guardianSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  relationship: z.string().trim().min(2).max(80),
  phoneNumber: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(320).nullable().default(null),
  address: addressSchema,
  governmentIdType: z.string().trim().min(2).max(80),
  governmentIdNumber: z.string().trim().min(3).max(120),
});

const applicationSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  phoneNumber: z.string().trim().min(7).max(40),
  address: addressSchema,
  governmentIdType: z.string().trim().min(2).max(80),
  governmentIdNumber: z.string().trim().min(3).max(120),
  guardian: guardianSchema.nullable().default(null),
  privacyNoticeAccepted: z.literal(true, {
    error: "Accept the verification privacy notice.",
  }),
  identityVerificationConsent: z.literal(true, {
    error: "Consent to identity verification is required.",
  }),
  guardianConsent: z.boolean().default(false),
});

const documentKindSchema = z.enum(documentKinds);

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected", "needs_changes"]),
  reasonCode: z.string().trim().min(2).max(80).nullable().default(null),
  note: z.string().trim().min(2).max(2_000).nullable().default(null),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError({
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "form",
        message: issue.message,
      })),
    });
  }
  return result.data;
}

function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError({ [name]: [`${name} is required.`] });
  }
  return value;
}

export function createVerificationController(service: VerificationService) {
  return {
    async status(request: Request, response: Response) {
      sendSuccess(response, await service.getStatus(authenticatedUserId(request)));
    },
    async saveApplication(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.saveApplication(authenticatedUserId(request), parse(applicationSchema, request.body)),
      );
    },
    async uploadDocument(request: Request, response: Response) {
      if (!Buffer.isBuffer(request.body)) {
        throw new ValidationError({ document: ["Choose a JPG, PNG, or PDF document."] });
      }
      const contentType = (request.header("content-type") ?? "").split(";")[0]?.trim();
      if (!contentType) throw new ValidationError({ document: ["The document type is missing."] });
      sendSuccess(
        response,
        await service.uploadDocument(
          authenticatedUserId(request),
          parse(documentKindSchema, parameter(request, "kind")),
          contentType,
          request.body,
        ),
      );
    },
    async submit(request: Request, response: Response) {
      sendSuccess(response, await service.submit(authenticatedUserId(request)));
    },
    async adminList(request: Request, response: Response) {
      const status = typeof request.query.status === "string" ? request.query.status.slice(0, 40) : undefined;
      sendSuccess(response, await service.listForAdmin(authenticatedUserId(request), status));
    },
    async adminDetail(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.getForAdmin(authenticatedUserId(request), requireUuidParam(request, "verificationId")),
      );
    },
    async adminClaim(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.claimForReview(authenticatedUserId(request), requireUuidParam(request, "verificationId")),
      );
    },
    async adminDecision(request: Request, response: Response) {
      sendSuccess(
        response,
        await service.decide(
          authenticatedUserId(request),
          requireUuidParam(request, "verificationId"),
          parse(reviewSchema, request.body),
        ),
      );
    },
  };
}

