import { Router } from "express";
import { z } from "zod";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { requireMfa, requireRecentAuthentication } from "../../shared/middleware/assurance.middleware.js";
import { endpointLimiter } from "../../shared/middleware/security-policy.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { VerificationService } from "../verification/verification.service.js";
import type { ProfessionalService } from "./professional.service.js";

const uuid = z.uuid();
const requestSchema = z.strictObject({
  organizationId: uuid,
  summary: z.string().trim().min(20).max(4000),
  preferredTime: z.string().trim().max(240).default(""),
  journalIds: z.array(uuid).max(3).default([]),
  consent: z.literal(true),
});
const appointmentSchema = z.strictObject({
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  mode: z.enum(["in_person", "online", "phone"]),
  locationHint: z.string().trim().max(240).default(""),
});
const organizationSchema = z.strictObject({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600).default(""),
  serviceHours: z.string().trim().max(240).default(""),
});
const memberSchema = z.strictObject({
  organizationId: uuid,
  userId: uuid,
  role: z.enum(["counselor", "psychologist", "social_worker", "coordinator", "org_admin"]),
  displayName: z.string().trim().min(2).max(120),
  credentialLabel: z.string().trim().min(2).max(160).nullable(),
  credentialExpiresAt: z.iso.date().nullable(),
  credentialChecked: z.literal(true),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ValidationError({
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      })),
    });
  return result.data;
}

export function createProfessionalRouter(
  service: ProfessionalService,
  verifier: AccessTokenVerifier,
  verification: VerificationService,
): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);
  router.use("/professional", authenticate, endpointLimiter(45));

  router.get("/professional/organizations", async (_request, response) => {
    sendSuccess(response, await service.listOrganizations());
  });
  router.get("/professional/me", async (request, response) => {
    sendSuccess(response, {
      ...(await service.memberships(request.auth!.id)),
      mfaRequired: request.auth!.assuranceLevel !== "aal2",
    });
  });
  router.get("/professional/my-requests", async (request, response) => {
    sendSuccess(response, await service.listOwnRequests(request.auth!.id));
  });
  router.post("/professional/my-requests", endpointLimiter(8), async (request, response) => {
    const input = parse(requestSchema, request.body);
    sendSuccess(response, await service.createRequest(request.auth!.id, input), 201);
  });
  router.get("/professional/my-requests/:requestId", async (request, response) => {
    sendSuccess(response, await service.detail(request.auth!.id, requireUuidParam(request, "requestId"), "user"));
  });
  router.post("/professional/my-requests/:requestId/revoke", async (request, response) => {
    sendSuccess(response, await service.revoke(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post("/professional/appointments/:appointmentId/respond", async (request, response) => {
    const { accept } = parse(z.strictObject({ accept: z.boolean() }), request.body);
    sendSuccess(
      response,
      await service.respondAppointment(request.auth!.id, requireUuidParam(request, "appointmentId"), accept),
    );
  });
  router.post("/professional/appointments/:appointmentId/cancel", async (request, response) => {
    sendSuccess(
      response,
      await service.cancelAppointment(request.auth!.id, requireUuidParam(request, "appointmentId")),
    );
  });

  router.get("/professional/organizations/:organizationId/queue", requireMfa, async (request, response) => {
    sendSuccess(response, await service.listQueue(request.auth!.id, requireUuidParam(request, "organizationId")));
  });
  router.get("/professional/cases/:requestId", requireMfa, async (request, response) => {
    sendSuccess(
      response,
      await service.detail(request.auth!.id, requireUuidParam(request, "requestId"), "professional"),
    );
  });
  router.post("/professional/cases/:requestId/claim", requireMfa, async (request, response) => {
    sendSuccess(response, await service.claim(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post("/professional/cases/:requestId/appointments", requireMfa, async (request, response) => {
    const input = parse(appointmentSchema, request.body);
    sendSuccess(
      response,
      await service.proposeAppointment(request.auth!.id, requireUuidParam(request, "requestId"), input),
      201,
    );
  });
  router.post("/professional/cases/:requestId/notes", requireMfa, async (request, response) => {
    const { body } = parse(z.strictObject({ body: z.string().trim().min(2).max(4000) }), request.body);
    sendSuccess(response, await service.addNote(request.auth!.id, requireUuidParam(request, "requestId"), body), 201);
  });
  router.post("/professional/cases/:requestId/referrals", requireMfa, async (request, response) => {
    const input = parse(
      z.strictObject({
        resourceName: z.string().trim().min(2).max(160),
        resourceUrl: z.url().startsWith("https://").nullable(),
      }),
      request.body,
    );
    sendSuccess(
      response,
      await service.addReferral(
        request.auth!.id,
        requireUuidParam(request, "requestId"),
        input.resourceName,
        input.resourceUrl,
      ),
      201,
    );
  });
  router.post("/professional/cases/:requestId/close", requireMfa, async (request, response) => {
    sendSuccess(response, await service.close(request.auth!.id, requireUuidParam(request, "requestId")));
  });

  router.get(
    "/professional/admin/organizations",
    requireMfa,
    requireRecentAuthentication,
    async (request, response) => {
      await verification.assertAdmin(request.auth!.id);
      sendSuccess(response, await service.listOrganizationsForAdmin());
    },
  );
  router.get(
    "/professional/admin/organizations/:organizationId/memberships",
    requireMfa,
    requireRecentAuthentication,
    async (request, response) => {
      await verification.assertAdmin(request.auth!.id);
      sendSuccess(response, await service.listMembersForAdmin(requireUuidParam(request, "organizationId")));
    },
  );
  router.get(
    "/professional/admin/organizations/:organizationId/audit",
    requireMfa,
    requireRecentAuthentication,
    async (request, response) => {
      await verification.assertAdmin(request.auth!.id);
      sendSuccess(response, await service.listAuditForAdmin(requireUuidParam(request, "organizationId")));
    },
  );
  router.post(
    "/professional/admin/organizations",
    requireMfa,
    requireRecentAuthentication,
    async (request, response) => {
      await verification.assertAdmin(request.auth!.id);
      sendSuccess(
        response,
        await service.createOrganization(request.auth!.id, parse(organizationSchema, request.body)),
        201,
      );
    },
  );
  router.post(
    "/professional/admin/organizations/:organizationId/approve",
    requireMfa,
    requireRecentAuthentication,
    async (request, response) => {
      await verification.assertAdmin(request.auth!.id);
      sendSuccess(
        response,
        await service.approveOrganization(request.auth!.id, requireUuidParam(request, "organizationId")),
      );
    },
  );
  router.post(
    "/professional/admin/organizations/:organizationId/suspend",
    requireMfa,
    requireRecentAuthentication,
    async (request, response) => {
      await verification.assertAdmin(request.auth!.id);
      sendSuccess(
        response,
        await service.suspendOrganization(request.auth!.id, requireUuidParam(request, "organizationId")),
      );
    },
  );
  router.post("/professional/admin/memberships", requireMfa, requireRecentAuthentication, async (request, response) => {
    await verification.assertAdmin(request.auth!.id);
    sendSuccess(response, await service.approveMember(request.auth!.id, parse(memberSchema, request.body)), 201);
  });
  router.post(
    "/professional/admin/memberships/:membershipId/suspend",
    requireMfa,
    requireRecentAuthentication,
    async (request, response) => {
      await verification.assertAdmin(request.auth!.id);
      sendSuccess(response, await service.suspendMember(request.auth!.id, requireUuidParam(request, "membershipId")));
    },
  );
  return router;
}
