import { Router } from "express";
import { z } from "zod";
import { createProfessionalRequestSchema } from "@echo/contracts";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { requireMfa, requireRecentAuthentication } from "../../shared/middleware/assurance.middleware.js";
import { endpointLimiter } from "../../shared/middleware/security-policy.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { VerificationService } from "../verification/verification.service.js";
import type { ProfessionalService } from "./professional.service.js";
import { professionalQueueQuery } from "./professional-queue.contract.js";
import { professionalMessageCursorSchema } from "./professional-message-cursor.js";

const uuid = z.uuid();
const revision = z.number().int().min(1).max(2147483646);
const followUpFields = { title: z.string().trim().min(2).max(240), dueAt: z.iso.datetime({ offset: true }) };
const legacyRequestSchema = z.strictObject({ organizationId: uuid, summary: z.string().trim().min(20).max(4000), preferredTime: z.string().trim().max(240).default(""), journalIds: z.array(uuid).max(3).default([]), consent: z.literal(true) });
const requestSchema = z.union([createProfessionalRequestSchema, legacyRequestSchema]);
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
  credentialId: uuid.optional(),
}).superRefine((input, context) => {
  if (["counselor", "psychologist", "social_worker"].includes(input.role) && !input.credentialId) {
    context.addIssue({ code: "custom", path: ["credentialId"], message: "An approved credential review is required." });
  }
});
const credentialSchema = z.strictObject({
  organizationId: uuid,
  role: z.enum(["counselor", "psychologist", "social_worker"]),
  credentialLabel: z.string().trim().min(2).max(160),
  expiresAt: z.iso.date(),
  evidenceReference: z.string().trim().min(20).max(4000),
});
const credentialDecisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("approved"), reasonCode: z.null() }),
  z.strictObject({ decision: z.literal("rejected"), reasonCode: z.enum(["invalid_evidence", "expired_credential", "unable_to_verify"]) }),
]);

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

  router.get("/professional/credentials", requireMfa, async (request, response) => {
    sendSuccess(response, await service.credentials.listOwn(request.auth!.id));
  });
  router.post("/professional/credentials", requireMfa, endpointLimiter(8), async (request, response) => {
    sendSuccess(response, await service.credentials.submit(request.auth!.id, parse(credentialSchema, request.body)), 201);
  });
  router.patch("/professional/credentials/:credentialId", requireMfa, endpointLimiter(8), async (request, response) => {
    const input = parse(z.strictObject({ credentialLabel: z.string().trim().min(2).max(160), expiresAt: z.iso.date() }), request.body);
    sendSuccess(response, await service.credentials.correct(request.auth!.id, requireUuidParam(request, "credentialId"), input));
  });
  const credentialAdminPath = "/professional/admin/organizations/:organizationId/credentials";
  router.get(credentialAdminPath, requireMfa, requireRecentAuthentication, async (request, response) => {
    await verification.assertAdmin(request.auth!.id);
    sendSuccess(response, await service.credentials.listForAdmin(requireUuidParam(request, "organizationId")));
  });
  router.get(`${credentialAdminPath}/:credentialId`, requireMfa, requireRecentAuthentication, async (request, response) => {
    await verification.assertAdmin(request.auth!.id);
    sendSuccess(response, await service.credentials.readForAdmin(
      request.auth!.id, requireUuidParam(request, "organizationId"), requireUuidParam(request, "credentialId"),
    ));
  });
  router.post(`${credentialAdminPath}/:credentialId/decision`, requireMfa, requireRecentAuthentication, async (request, response) => {
    await verification.assertAdmin(request.auth!.id);
    sendSuccess(response, await service.credentials.review(
      request.auth!.id, requireUuidParam(request, "organizationId"), requireUuidParam(request, "credentialId"),
      parse(credentialDecisionSchema, request.body),
    ));
  });

  router.get("/professional/organizations", async (_request, response) => {
    sendSuccess(response, await service.listOrganizations());
  });
  router.get("/professional/hub", async (request, response) => {
    sendSuccess(response, await service.hub(request.auth!.id));
  });
  router.get("/professional/directory", async (request, response) => {
    const input = parse(
      z.strictObject({
        query: z.string().trim().max(120).optional(),
        organizationId: uuid.optional(),
        specialization: z.string().trim().max(80).optional(),
        serviceType: z.string().trim().max(80).optional(),
        consultationMethod: z.string().trim().max(80).optional(),
        location: z.string().trim().max(120).optional(),
        cursor: z.iso.datetime({ offset: true }).optional(),
        limit: z.coerce.number().int().min(1).max(30).default(12),
      }),
      request.query,
    );
    sendSuccess(response, await service.directory(input));
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
  router.patch("/professional/my-requests/:requestId", async (request, response) => {
    const input = parse(z.strictObject({ summary: z.string().trim().min(20).max(4000), preferredTime: z.string().trim().max(240) }), request.body);
    sendSuccess(response, await service.updateOwnRequest(request.auth!.id, requireUuidParam(request, "requestId"), input));
  });
  router.post("/professional/my-requests/:requestId/cancel", async (request, response) => {
    parse(z.strictObject({}), request.body ?? {});
    sendSuccess(response, await service.withdrawOwnRequest(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post("/professional/my-requests/:requestId/revoke", async (request, response) => {
    sendSuccess(response, await service.revoke(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post("/professional/my-requests/:requestId/withdraw", async (request, response) => {
    sendSuccess(response, await service.withdraw(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post("/professional/my-requests/:requestId/reassignment-requests", async (request, response) => {
    parse(z.strictObject({ reason: z.string().trim().max(500).default("") }), request.body);
    sendSuccess(response, await service.addUserCaseEvent(
      request.auth!.id,
      requireUuidParam(request, "requestId"),
      "reassignment_requested",
      "Reassignment requested",
    ), 201);
  });
  router.post("/professional/my-requests/:requestId/concerns", async (request, response) => {
    const { category } = parse(z.strictObject({ category: z.enum(["privacy", "communication", "conduct", "other"]) }), request.body);
    sendSuccess(response, await service.addUserCaseEvent(
      request.auth!.id,
      requireUuidParam(request, "requestId"),
      "concern_reported",
      `Concern reported: ${category}`,
    ), 201);
  });
  router.get("/professional/my-requests/:requestId/sharing", async (request, response) => {
    sendSuccess(response, await service.sharing(request.auth!.id, requireUuidParam(request, "requestId"), "owner"));
  });
  router.post("/professional/my-requests/:requestId/sharing", async (request, response) => {
    const input = parse(z.strictObject({
      journalIds: z.array(uuid).max(3).default([]),
      phq8Ids: z.array(uuid).max(3).default([]),
      consent: z.literal(true),
    }), request.body);
    sendSuccess(response, await service.addSharing(request.auth!.id, requireUuidParam(request, "requestId"), input), 201);
  });
  router.delete("/professional/my-requests/:requestId/sharing/:shareId", async (request, response) => {
    sendSuccess(response, await service.revokeSharedRecord(
      request.auth!.id,
      requireUuidParam(request, "requestId"),
      requireUuidParam(request, "shareId"),
    ));
  });
  router.get("/professional/my-requests/:requestId/timeline", async (request, response) => {
    sendSuccess(response, await service.timeline(request.auth!.id, requireUuidParam(request, "requestId"), "owner"));
  });
  router.get("/professional/my-requests/:requestId/messages", async (request, response) => {
    const input = parse(z.strictObject({
      before: professionalMessageCursorSchema.optional(),
      limit: z.coerce.number().int().min(1).max(50).default(30),
    }), request.query);
    sendSuccess(response, await service.messages(request.auth!.id, requireUuidParam(request, "requestId"), input.before, input.limit, "owner"));
  });
  router.post("/professional/my-requests/:requestId/messages", endpointLimiter(20), async (request, response) => {
    const input = parse(z.strictObject({ clientMessageId: uuid, body: z.string().trim().min(1).max(4000) }), request.body);
    sendSuccess(response, await service.sendMessage(
      request.auth!.id,
      requireUuidParam(request, "requestId"),
      input.clientMessageId,
      input.body,
      "owner",
    ), 201);
  });
  router.patch("/professional/my-requests/:requestId/messages/read", async (request, response) => {
    sendSuccess(response, await service.markMessagesRead(request.auth!.id, requireUuidParam(request, "requestId"), "owner"));
  });
  router.get("/professional/appointments", async (request, response) => {
    const range = parse(z.strictObject({
      from: z.iso.datetime({ offset: true }).optional(),
      to: z.iso.datetime({ offset: true }).optional(),
    }), request.query);
    if (Boolean(range.from) !== Boolean(range.to) ||
        (range.from && range.to && (Date.parse(range.from) >= Date.parse(range.to) ||
          Date.parse(range.to) - Date.parse(range.from) > 62 * 86_400_000))) {
      throw new ValidationError({ range: ["Choose a valid appointment range of up to 62 days."] });
    }
    sendSuccess(response, await service.listOwnAppointments(request.auth!.id, range));
  });
  router.post("/professional/appointments/:appointmentId/respond", async (request, response) => {
    const { accept } = parse(z.strictObject({ accept: z.boolean() }), request.body);
    sendSuccess(
      response,
      await service.respondAppointment(request.auth!.id, requireUuidParam(request, "appointmentId"), accept),
    );
  });
  router.post("/professional/appointments/:appointmentId/reschedule", requireMfa, async (request, response) => {
    sendSuccess(response, await service.rescheduleAppointment(request.auth!.id, requireUuidParam(request, "appointmentId"), parse(appointmentSchema, request.body)));
  });
  router.post("/professional/appointments/:appointmentId/cancel", async (request, response) => {
    sendSuccess(
      response,
      await service.cancelAppointment(
        request.auth!.id,
        requireUuidParam(request, "appointmentId"),
        request.auth!.assuranceLevel,
      ),
    );
  });
  router.post("/professional/appointments/:appointmentId/complete", requireMfa, async (request, response) => {
    sendSuccess(
      response,
      await service.completeAppointment(request.auth!.id, requireUuidParam(request, "appointmentId")),
    );
  });
  router.post("/professional/appointments/:appointmentId/change-requests", async (request, response) => {
    const { preferredTime } = parse(z.strictObject({ preferredTime: z.string().trim().min(2).max(500) }), request.body);
    sendSuccess(response, await service.requestAppointmentChange(
      request.auth!.id,
      requireUuidParam(request, "appointmentId"),
      preferredTime,
    ), 201);
  });

  router.get("/professional/organizations/:organizationId/queue", requireMfa, async (request, response) => {
    sendSuccess(response, await service.listQueue(request.auth!.id, requireUuidParam(request, "organizationId"), parse(professionalQueueQuery, request.query)));
  });
  router.get("/professional/organizations/:organizationId/dashboard", requireMfa, async (request, response) => {
    parse(z.strictObject({}), request.query);
    sendSuccess(response, await service.dashboard(request.auth!.id, requireUuidParam(request, "organizationId")));
  });
  router.get("/professional/organizations/:organizationId/notifications", requireMfa, async (request, response) => {
    const { status } = parse(z.strictObject({ status: z.enum(["all", "unread"]).default("all") }), request.query);
    sendSuccess(response, await service.notifications.list(request.auth!.id, requireUuidParam(request, "organizationId"), status === "unread"));
  });
  router.patch("/professional/organizations/:organizationId/notifications/:notificationId/read", requireMfa, async (request, response) => {
    parse(z.strictObject({}), request.body ?? {});
    sendSuccess(response, await service.notifications.read(request.auth!.id, requireUuidParam(request, "organizationId"), requireUuidParam(request, "notificationId")));
  });
  router.get("/professional/cases/:requestId", requireMfa, async (request, response) => {
    sendSuccess(
      response,
      await service.detail(request.auth!.id, requireUuidParam(request, "requestId"), "professional"),
    );
  });
  router.get("/professional/cases/:requestId/sharing", requireMfa, async (request, response) => {
    sendSuccess(response, await service.sharing(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.get("/professional/cases/:requestId/timeline", requireMfa, async (request, response) => {
    sendSuccess(response, await service.timeline(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.get("/professional/cases/:requestId/messages", requireMfa, async (request, response) => {
    const input = parse(z.strictObject({
      before: professionalMessageCursorSchema.optional(),
      limit: z.coerce.number().int().min(1).max(50).default(30),
    }), request.query);
    sendSuccess(response, await service.messages(request.auth!.id, requireUuidParam(request, "requestId"), input.before, input.limit));
  });
  router.post("/professional/cases/:requestId/messages", requireMfa, endpointLimiter(20), async (request, response) => {
    const input = parse(z.strictObject({ clientMessageId: uuid, body: z.string().trim().min(1).max(4000) }), request.body);
    sendSuccess(response, await service.sendMessage(
      request.auth!.id,
      requireUuidParam(request, "requestId"),
      input.clientMessageId,
      input.body,
    ), 201);
  });
  router.patch("/professional/cases/:requestId/messages/read", requireMfa, async (request, response) => {
    sendSuccess(response, await service.markMessagesRead(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post("/professional/cases/:requestId/claim", requireMfa, async (request, response) => {
    sendSuccess(response, await service.claim(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.get("/professional/cases/:requestId/crisis-support", requireMfa, async (request, response) => {
    parse(z.strictObject({}), request.query);
    sendSuccess(response, await service.crisisSupport(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post("/professional/cases/:requestId/assign", requireMfa, async (request, response) => {
    const { profileId } = parse(z.strictObject({ profileId: uuid }), request.body);
    sendSuccess(response, await service.assign(request.auth!.id, requireUuidParam(request, "requestId"), profileId));
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
    const { body, ...options } = parse(z.strictObject({ body: z.string().trim().min(2).max(4000), submissionId: uuid.optional(), state: z.enum(["draft", "final"]).optional() }), request.body);
    sendSuccess(response, await service.addNote(request.auth!.id, requireUuidParam(request, "requestId"), body, options), 201);
  });
  router.patch("/professional/cases/:requestId/notes/:noteId", requireMfa, async (request, response) => {
    const input = parse(z.strictObject({ body: z.string().trim().min(2).max(4000), expectedRevision: z.number().int().min(1).max(2147483646), finalize: z.boolean() }), request.body);
    sendSuccess(response, await service.editNote(request.auth!.id, requireUuidParam(request, "requestId"), requireUuidParam(request, "noteId"), input));
  });
  router.post("/professional/cases/:requestId/referrals", requireMfa, async (request, response) => {
    const input = parse(
      z.strictObject({
        resourceName: z.string().trim().min(2).max(160),
        resourceUrl: z.url().startsWith("https://").max(2048).nullable(),
        submissionId: uuid.optional(),
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
        input.submissionId,
      ),
      201,
    );
  });
  const followUpsPath = "/professional/cases/:requestId/follow-ups";
  router.get("/professional/cases/:requestId/referrals", requireMfa, async (request, response) => {
    parse(z.strictObject({}), request.query);
    sendSuccess(response, await service.referrals.list(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.patch("/professional/cases/:requestId/referrals/:referralId", requireMfa, async (request, response) => {
    const input = parse(z.strictObject({ status: z.enum(["completed", "canceled"]), expectedRevision: revision }), request.body);
    sendSuccess(response, await service.referrals.setStatus(request.auth!.id, requireUuidParam(request, "requestId"), requireUuidParam(request, "referralId"), input.status, input.expectedRevision));
  });
  router.get(followUpsPath, requireMfa, async (request, response) => {
    parse(z.strictObject({}), request.query);
    sendSuccess(response, await service.followUps.list(request.auth!.id, requireUuidParam(request, "requestId")));
  });
  router.post(followUpsPath, requireMfa, async (request, response) => {
    sendSuccess(response, await service.followUps.create(request.auth!.id, requireUuidParam(request, "requestId"),
      parse(z.strictObject({ ...followUpFields, submissionId: uuid }), request.body)), 201);
  });
  router.patch(`${followUpsPath}/:followUpId`, requireMfa, async (request, response) => {
    const { expectedRevision, ...input } = parse(z.strictObject({ ...followUpFields, expectedRevision: revision }), request.body);
    sendSuccess(response, await service.followUps.update(request.auth!.id, requireUuidParam(request, "requestId"), requireUuidParam(request, "followUpId"), expectedRevision, input));
  });
  router.post(`${followUpsPath}/:followUpId/complete`, requireMfa, async (request, response) => {
    const { expectedRevision } = parse(z.strictObject({ expectedRevision: revision }), request.body);
    sendSuccess(response, await service.followUps.update(request.auth!.id, requireUuidParam(request, "requestId"), requireUuidParam(request, "followUpId"), expectedRevision, null));
  });
  router.post("/professional/cases/:requestId/close", requireMfa, async (request, response) => {
    const { reason } = parse(z.strictObject({ reason: z.string().trim().min(2).max(2000).optional() }), request.body ?? {});
    sendSuccess(response, await service.close(request.auth!.id, requireUuidParam(request, "requestId"), reason));
  });
  router.post("/professional/cases/:requestId/transfer", requireMfa, async (request, response) => {
    const input = parse(z.strictObject({ targetUserId: uuid, reason: z.string().trim().min(10).max(2000), submissionId: uuid }), request.body);
    sendSuccess(response, await service.transfer(request.auth!.id, requireUuidParam(request, "requestId"), input));
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
      sendSuccess(response, await service.listAuditForAdmin(requireUuidParam(request, "organizationId"), request.auth!.id));
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
