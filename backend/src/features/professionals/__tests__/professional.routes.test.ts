import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { AuthorizationError } from "../../../shared/errors/app-error.js";
import type { VerificationService } from "../../verification/verification.service.js";
import type { ProfessionalService } from "../professional.service.js";

const USER = "fe000000-0000-4000-8000-000000000001";
const CASE = "fe000000-0000-4000-8000-000000000002";
const ORG = "fe000000-0000-4000-8000-000000000003";

function harness() {
  const service = {
    createRequest: vi.fn().mockResolvedValue({ request: { id: CASE } }),
    hub: vi.fn().mockResolvedValue({ activeCases: [], recentCases: [] }),
    directory: vi.fn().mockResolvedValue({ practitioners: [], nextCursor: null }),
    sendMessage: vi.fn().mockResolvedValue({ message: { id: CASE } }),
    completeAppointment: vi.fn().mockResolvedValue({ appointmentId: CASE, status: "completed" }),
    listOwnAppointments: vi.fn().mockResolvedValue({ appointments: [] }),
    detail: vi.fn().mockResolvedValue({ request: { id: CASE } }),
    memberships: vi.fn().mockResolvedValue({ userId: USER, memberships: [] }),
    listOrganizationsForAdmin: vi.fn().mockResolvedValue({ organizations: [] }),
    listAuditForAdmin: vi.fn().mockResolvedValue({ events: [] }),
    suspendMember: vi.fn().mockResolvedValue({ status: "suspended" }),
  };
  const verification = {
    assertAdmin: vi.fn(async (userId: string) => {
      if (userId !== USER) throw new AuthorizationError("Administrator access required.");
    }),
  };
  const verifier = {
    getUser: vi.fn(async (token: string) =>
      token === "basic" || token === "mfa" || token === "old-mfa"
        ? {
            id: USER,
            email: "user@example.test",
            assuranceLevel: token === "basic" ? "aal1" : "aal2",
            authenticatedAt: Date.now() / 1000 - (token === "old-mfa" ? 700 : 0),
          }
        : null,
    ),
  };
  return {
    service,
    verification,
    app: createApp({
      v1: {
        professionals: {
          service: service as unknown as ProfessionalService,
          verificationService: verification as unknown as VerificationService,
          verifier,
        },
      },
    }),
  };
}

describe("professional portal routes", () => {
  it("reports professional memberships without treating sign-in as professional approval", async () => {
    const { app, service } = harness();
    const basic = await request(app).get("/api/v1/professional/me").set("Authorization", "Bearer basic");
    expect(basic.status).toBe(200);
    expect(basic.body.data).toMatchObject({ userId: USER, memberships: [], mfaRequired: true });
    const mfa = await request(app).get("/api/v1/professional/me").set("Authorization", "Bearer mfa");
    expect(mfa.body.data.mfaRequired).toBe(false);
    expect(service.memberships).toHaveBeenCalledWith(USER);
  });

  it("requires explicit consent and validates the request before storing it", async () => {
    const { app, service } = harness();
    const path = "/api/v1/professional/my-requests";
    const input = {
      submissionId: "fe000000-0000-4000-8000-000000000004",
      organizationId: ORG,
      preferredProfileId: null,
      summary: "I would like scheduled professional support.",
      preferredTime: "Weekday afternoons",
      journalIds: [],
      phq8Ids: [],
      consent: false,
    };
    expect(
      (
        await request(app)
          .post(path)
          .send({ ...input, consent: true })
      ).status,
    ).toBe(401);
    expect((await request(app).post(path).set("Authorization", "Bearer basic").send(input)).status).toBe(400);
    expect(service.createRequest).not.toHaveBeenCalled();
    const accepted = await request(app)
      .post(path)
      .set("Authorization", "Bearer basic")
      .send({ ...input, consent: true });
    expect(accepted.status).toBe(201);
    expect(service.createRequest).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ organizationId: ORG, consent: true }),
    );
  });

  it("loads the owner-scoped hub and validates idempotent case messages", async () => {
    const { app, service } = harness();
    const hub = await request(app).get("/api/v1/professional/hub").set("Authorization", "Bearer basic");
    expect(hub.status).toBe(200);
    expect(service.hub).toHaveBeenCalledWith(USER);

    const path = `/api/v1/professional/my-requests/${CASE}/messages`;
    expect((await request(app).post(path).set("Authorization", "Bearer basic").send({ body: "hello" })).status).toBe(400);
    const sent = await request(app).post(path).set("Authorization", "Bearer basic").send({
      clientMessageId: "fe000000-0000-4000-8000-000000000005",
      body: "Could we discuss the next appointment?",
    });
    expect(sent.status).toBe(201);
    expect(service.sendMessage).toHaveBeenCalledWith(
      USER,
      CASE,
      "fe000000-0000-4000-8000-000000000005",
      "Could we discuss the next appointment?",
    );
  });

  it("requires MFA before opening a professional case", async () => {
    const { app, service } = harness();
    const path = `/api/v1/professional/cases/${CASE}`;
    expect((await request(app).get(path).set("Authorization", "Bearer basic")).status).toBe(403);
    expect(service.detail).not.toHaveBeenCalled();
    expect((await request(app).get(path).set("Authorization", "Bearer mfa")).status).toBe(200);
    expect(service.detail).toHaveBeenCalledWith(USER, CASE, "professional");
  });

  it("requires MFA before a professional completes an appointment", async () => {
    const { app, service } = harness();
    const path = `/api/v1/professional/appointments/${CASE}/complete`;
    expect((await request(app).post(path).set("Authorization", "Bearer basic")).status).toBe(403);
    expect(service.completeAppointment).not.toHaveBeenCalled();
    expect((await request(app).post(path).set("Authorization", "Bearer mfa")).status).toBe(200);
    expect(service.completeAppointment).toHaveBeenCalledWith(USER, CASE);
  });

  it("accepts a bounded calendar range and rejects incomplete or oversized ranges", async () => {
    const { app, service } = harness();
    const path = "/api/v1/professional/appointments";
    const authorization = "Bearer basic";
    const from = "2026-10-01T00:00:00.000Z";
    const to = "2026-11-01T00:00:00.000Z";
    expect((await request(app).get(path).set("Authorization", authorization).query({ from })).status).toBe(400);
    expect((await request(app).get(path).set("Authorization", authorization).query({ from, to: "2027-01-01T00:00:00.000Z" })).status).toBe(400);
    const result = await request(app).get(path).set("Authorization", authorization).query({ from, to });
    expect(result.status).toBe(200);
    expect(service.listOwnAppointments).toHaveBeenCalledWith(USER, { from, to });
  });

  it("requires recent MFA and administrator authorization for provisioning", async () => {
    const { app, service, verification } = harness();
    const path = "/api/v1/professional/admin/organizations";
    expect((await request(app).get(path).set("Authorization", "Bearer basic")).status).toBe(403);
    expect((await request(app).get(path).set("Authorization", "Bearer old-mfa")).status).toBe(403);
    expect(service.listOrganizationsForAdmin).not.toHaveBeenCalled();
    expect((await request(app).get(path).set("Authorization", "Bearer mfa")).status).toBe(200);
    expect(verification.assertAdmin).toHaveBeenCalledWith(USER);
    const auditPath = `/api/v1/professional/admin/organizations/${ORG}/audit`;
    expect((await request(app).get(auditPath).set("Authorization", "Bearer basic")).status).toBe(403);
    expect(service.listAuditForAdmin).not.toHaveBeenCalled();
    expect((await request(app).get(auditPath).set("Authorization", "Bearer mfa")).status).toBe(200);
    expect(service.listAuditForAdmin).toHaveBeenCalledWith(ORG);
  });
});
