import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService, encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { AuthorizationError } from "../../../shared/errors/app-error.js";
import type { AccessService } from "../../access/access.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";

const ACTOR = "fe000000-0000-4000-8000-000000000001";
const OWNER = "fe000000-0000-4000-8000-000000000002";
const ORG = "fe000000-0000-4000-8000-000000000003";
const CASE = "fe000000-0000-4000-8000-000000000004";
const APPOINTMENT = "fe000000-0000-4000-8000-000000000005";
const OTHER_ORG = "fe000000-0000-4000-8000-000000000006";
const MEMBER = "fe000000-0000-4000-8000-000000000007";
const encryption = createEncryptionService(Buffer.alloc(32, 1).toString("base64"), 1);
type Row = Record<string, unknown>;
const approved = {
  id: MEMBER, user_id: ACTOR, organization_id: ORG, role: "counselor",
  status: "active", credential_expires_at: "2099-12-31",
};

// Filter-aware database double: changing an organization/actor ID changes the
// returned row. RPCs are spies here; actual SQL enforcement is tested separately.
function harness(options: { member?: Row | null; organization?: Row | null; assignedTo?: string; sharing?: boolean; rpcError?: string; afterRead?: (table: string, tables: Record<string, Row[]>) => void } = {}) {
  const tables: Record<string, Row[]> = {
    memberships: options.member === null ? [] : [structuredClone(options.member ?? approved)],
    organizations: options.organization === null ? [] : [options.organization ?? { id: ORG, status: "active" }],
    support_requests: [{
      id: CASE, organization_id: ORG, user_id: OWNER, assigned_to: options.assignedTo ?? ACTOR,
      status: "assigned", sharing_revoked_at: options.sharing ? null : "2026-01-01", sharing_expires_at: "2099-12-31",
      summary_encrypted: encryptText("Synthetic shared message", encryption),
      preferred_time_encrypted: encryptText("Synthetic preference", encryption),
    }],
    shared_journals: [{ request_id: CASE, journal_id: MEMBER, title_encrypted: encryptText("Synthetic journal", encryption), body_encrypted: encryptText("Synthetic journal body", encryption) }],
    appointments: [{ id: APPOINTMENT, request_id: CASE, status: "proposed", location_hint_encrypted: encryptText("Synthetic location", encryption) }],
  };
  const writes = vi.fn();
  const from = vi.fn((table: string) => {
    const filters: [string, unknown][] = [];
    let inserted: Row | undefined;
    const rows = () => inserted ? [{ id: MEMBER, ...inserted }] : (tables[table] ?? [])
      .filter((row) => filters.every(([key, value]) => row[key] === value));
    const result = () => { const data = rows(); options.afterRead?.(table, tables); return { data, error: null, count: data.length }; };
    const query = {
      select: vi.fn(() => query),
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query,
      limit: () => query,
      range: () => query,
      insert: (row: Row) => { writes(table, row); inserted = row; return query; },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === "case_snapshot") {
      const data = structuredClone({ request: tables.support_requests[0], sharedJournals: tables.shared_journals,
        appointments: tables.appointments, notes: [], referrals: [] });
      options.afterRead?.("case_notes", tables);
      return { data, error: options.rpcError ? { message: options.rpcError } : null };
    }
    if (name === "close_case") return { data: { request: tables.support_requests[0], reasonEncrypted: args.p_reason_encrypted }, error: options.rpcError ? { message: options.rpcError } : null };
    if (name === "reschedule_appointment") return { data: { id: APPOINTMENT, status: "proposed", location_hint_encrypted: args.p_location_hint_encrypted }, error: options.rpcError ? { message: options.rpcError } : null };
    if (name === "transfer_case") return { data: { request: { ...tables.support_requests[0], assigned_to: args.p_target }, transferId: MEMBER, reasonEncrypted: args.p_reason_encrypted }, error: options.rpcError ? { message: options.rpcError } : null };
    return { data: name === "save_case_note" ? { id: MEMBER, body_encrypted: args.p_body_encrypted, state: args.p_state, revision: 1 } : name === "cancel_appointment" ? { id: APPOINTMENT, status: "canceled" } : tables.support_requests[0],
      error: options.rpcError ? { message: options.rpcError } : null };
  });
  const database = { schema: () => ({ from, rpc }) } as unknown as SupabaseClient;
  const service = new ProfessionalService(database, encryption, {} as JournalService);
  const decide = vi.fn().mockResolvedValue({ decision: "ACCESS_GRANTED" });
  const verifier = { getUser: vi.fn(async (token: string) => ({
    id: token === "owner" ? OWNER : ACTOR,
    assuranceLevel: token === "mfa" ? "aal2" as const : "aal1" as const,
    authenticatedAt: Date.now() / 1000,
  })) };
  const assertAdmin = vi.fn().mockRejectedValue(new AuthorizationError());
  const app = createApp({ v1: {
    access: { service: { decide, hasPendingDeletion: async () => false } as unknown as AccessService, verifier },
    professionals: { service, verifier, verificationService: { assertAdmin } as unknown as VerificationService },
  } });
  return { app, service, from, rpc, writes, decide, assertAdmin };
}

const deniedMemberships = [
  { name: "no membership after sign-in", member: null },
  { name: "pending membership", member: { ...approved, status: "pending" } },
  { name: "suspended membership", member: { ...approved, status: "suspended" } },
  { name: "expired credential", member: { ...approved, credential_expires_at: "2020-01-01" } },
  { name: "missing credential expiry", member: { ...approved, credential_expires_at: null } },
  { name: "malformed credential expiry", member: { ...approved, credential_expires_at: "not-a-date" } },
  { name: "impossible credential expiry", member: { ...approved, credential_expires_at: "2099-02-31" } },
  { name: "unrecognized role", member: { ...approved, role: "unrecognized" } },
  { name: "membership in another organization", member: { ...approved, organization_id: OTHER_ORG } },
  { name: "another user's membership", member: { ...approved, user_id: OWNER } },
  { name: "pending organization", organization: { id: ORG, status: "pending" } },
  { name: "suspended organization", organization: { id: ORG, status: "suspended" } },
  { name: "missing organization", organization: null },
];
const clinicalOperations: [string, (service: ProfessionalService) => Promise<unknown>][] = [
  ["claim", (service) => service.claim(ACTOR, CASE)],
  ["detail", (service) => service.detail(ACTOR, CASE, "professional")],
  ["close", (service) => service.close(ACTOR, CASE)],
  ["note", (service) => service.addNote(ACTOR, CASE, "Synthetic note")],
  ["referral", (service) => service.addReferral(ACTOR, CASE, "Synthetic resource", null)],
  ["appointment", (service) => service.proposeAppointment(ACTOR, CASE, {
    startsAt: "2099-01-01T10:00:00Z", endsAt: "2099-01-01T11:00:00Z", mode: "online", locationHint: "",
  })],
  ["cancel", (service) => service.cancelAppointment(ACTOR, APPOINTMENT, "aal2")],
];

describe("professional role and tenant authorization", () => {
  it("requires MFA and rejects forged actors on transactional rescheduling", async () => {
    const { app, rpc } = harness(); const path = `/api/v1/professional/appointments/${APPOINTMENT}/reschedule`;
    const input = { startsAt: "2099-01-01T10:00:00Z", endsAt: "2099-01-01T11:00:00Z", mode: "online", locationHint: "Synthetic meeting detail" };
    expect((await request(app).post(path).set("Authorization", "Bearer owner").send(input)).status).toBe(403);
    expect((await request(app).post(path).set("Authorization", "Bearer mfa").send({ ...input, actor: OWNER })).status).toBe(400); expect(rpc).not.toHaveBeenCalled();
    const response = await request(app).post(path).set("Authorization", "Bearer mfa").send(input);
    expect(response.status).toBe(200); expect(response.body.data).toEqual({ appointmentId: APPOINTMENT, status: "proposed" });
    expect(rpc).toHaveBeenCalledWith("reschedule_appointment", expect.objectContaining({ p_actor: ACTOR, p_appointment_id: APPOINTMENT }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(input.locationHint);
  });
  it.each([["INVALID_APPOINTMENT", 400], ["APPOINTMENT_EXPIRED", 409], ["APPOINTMENT_CONFLICT", 409], ["APPOINTMENT_UNAVAILABLE", 409], ["MEMBERSHIP_REQUIRED", 403], ["REQUEST_NOT_FOUND", 404], ["Private SQL appointment diagnostic", 503]])("maps appointment failure %s to %s without diagnostics", async (rpcError, statusCode) => {
    const { service } = harness({ rpcError: String(rpcError) });
    const input = { startsAt: "2099-01-01T10:00:00Z", endsAt: "2099-01-01T11:00:00Z", mode: "online" as const, locationHint: "" };
    for (const operation of [() => service.proposeAppointment(ACTOR, CASE, input), () => service.respondAppointment(OWNER, APPOINTMENT, true), () => service.cancelAppointment(ACTOR, APPOINTMENT, "aal2"), () => service.rescheduleAppointment(ACTOR, APPOINTMENT, input)]) {
      await expect(operation()).rejects.toMatchObject({ statusCode });
      await expect(operation()).rejects.not.toThrow("Private SQL appointment diagnostic");
    }
  });
  it("authorizes and encrypts a same-organization transfer without exposing its reason", async () => {
    const { app, rpc } = harness();
    const input = { targetUserId: OWNER, reason: "Synthetic handover reason", submissionId: MEMBER };
    const path = `/api/v1/professional/cases/${CASE}/transfer`;
    expect((await request(app).post(path).set("Authorization", "Bearer password").send(input)).status).toBe(403);
    expect((await request(app).post(path).set("Authorization", "Bearer mfa").send({ ...input, actor: OWNER })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    const response = await request(app).post(path).set("Authorization", "Bearer mfa").send(input);
    expect(response.status).toBe(200); expect(response.body.data.request.assignedTo).toBe(OWNER);
    expect(rpc).toHaveBeenCalledWith("transfer_case", expect.objectContaining({ p_actor: ACTOR, p_target: OWNER, p_submission_id: MEMBER }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(input.reason); expect(JSON.stringify(response.body)).not.toMatch(/reason|encrypted/);
  });
  it("records an optional encrypted closure reason and rejects unknown closure fields", async () => {
    const { app, rpc } = harness(); const path = `/api/v1/professional/cases/${CASE}/close`;
    expect((await request(app).post(path).set("Authorization", "Bearer mfa").send({ reason: "Synthetic completed support", actor: OWNER })).status).toBe(400);
    expect((await request(app).post(path).set("Authorization", "Bearer mfa").send({ reason: "Synthetic completed support" })).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("close_case", expect.objectContaining({ p_actor: ACTOR, p_reason_encrypted: expect.stringMatching(/^echo:encrypted:/) }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("Synthetic completed support");
  });
  it.each(["TRANSFER_TARGET_UNAVAILABLE", "TRANSFER_CONFLICT", "DRAFT_NOTES_PENDING"])("maps %s to a safe handover conflict", async (rpcError) => {
    const { service } = harness({ rpcError });
    await expect(service.transfer(ACTOR, CASE, { targetUserId: OWNER, submissionId: MEMBER, reason: "Synthetic handover" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each([
    ["MEMBERSHIP_REQUIRED", 403], ["ASSIGNMENT_REQUIRED", 403], ["REQUEST_NOT_FOUND", 404],
    ["REQUEST_ALREADY_ASSIGNED", 409], ["INVALID_CASE_TRANSITION", 409], ["APPOINTMENT_ACTIVE", 409],
    ["Private database diagnostic", 503],
  ])("maps current-state SQL failure %s to %s for claim and closure", async (message, statusCode) => {
    const { service } = harness({ rpcError: String(message) });
    for (const operation of [() => service.claim(ACTOR, CASE), () => service.close(ACTOR, CASE)]) {
      await expect(operation()).rejects.toMatchObject({ statusCode });
      await expect(operation()).rejects.not.toThrow("Private database diagnostic");
    }
  });
  it("discards sharing revoked during child reads before decrypting or returning snapshots", async () => {
    const { service } = harness({ sharing: true, afterRead(table, tables) {
      if (table === "case_notes") tables.support_requests[0].sharing_revoked_at = "2026-10-14T00:00:00Z";
    } });
    const result = await service.detail(ACTOR, CASE, "professional");
    expect(result.sharedJournals).toEqual([]);
    expect(result.request).toMatchObject({ sharingActive: false, summary: null, preferredTime: "" });
    expect(JSON.stringify(result)).not.toContain("Synthetic journal");
  });
  it.each(["membership", "organization"])("rechecks %s suspension after loading queue metadata", async (kind) => {
    const { service } = harness({ afterRead(table, tables) {
      if (table === "support_requests") tables[kind === "membership" ? "memberships" : "organizations"][0].status = "suspended";
    } });
    await expect(service.listQueue(ACTOR, ORG)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it.each(["suspension", "assignment", "role"])("discards a case when %s changes during child reads", async (kind) => {
    const { service } = harness({ afterRead(table, tables) {
      if (table !== "case_notes") return;
      if (kind === "suspension") tables.memberships[0].status = "suspended";
      if (kind === "role") tables.memberships[0].role = "coordinator";
      if (kind === "assignment") tables.support_requests[0].assigned_to = OWNER;
    } });
    await expect(service.detail(ACTOR, CASE, "professional")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it.each(deniedMemberships)("denies $name before queue data, case contents or mutations", async (options) => {
    const queue = harness(options);
    await expect(queue.service.listQueue(ACTOR, ORG)).rejects.toBeInstanceOf(AuthorizationError);
    expect(queue.from).not.toHaveBeenCalledWith("support_requests");
    for (const [, operation] of clinicalOperations) {
      const { service, from, writes, rpc } = harness(options);
      await expect(operation(service)).rejects.toBeInstanceOf(AuthorizationError);
      expect(from).not.toHaveBeenCalledWith("shared_journals");
      expect(from).not.toHaveBeenCalledWith("case_notes");
      expect(writes).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it.each(["coordinator", "org_admin"])("allows %s queue metadata but denies clinical actions", async (role) => {
    const options = { member: { ...approved, role, credential_expires_at: null } };
    const queue = harness(options);
    const result = await queue.service.listQueue(ACTOR, ORG);
    expect(result.requests[0]).toMatchObject({ id: CASE, organizationId: ORG });
    expect(result.requests[0]).not.toHaveProperty("userId");
    expect(result.requests[0]).not.toHaveProperty("summary");
    expect(queue.writes).toHaveBeenCalledWith("audit_events", expect.objectContaining({ action: "queue.viewed" }));
    for (const [, operation] of clinicalOperations) {
      const { service, rpc, writes } = harness(options);
      await expect(operation(service)).rejects.toBeInstanceOf(AuthorizationError);
      expect(rpc).not.toHaveBeenCalled();
      expect(writes).not.toHaveBeenCalled();
    }
  });

  it.each(["counselor", "psychologist", "social_worker"])("preserves assigned %s workflows", async (role) => {
    for (const [, operation] of clinicalOperations) {
      const { service } = harness({ member: { ...approved, role } });
      await expect(operation(service)).resolves.toBeDefined();
    }
  });

  it("denies a forged organization and another practitioner's case", async () => {
    const { service, rpc, writes } = harness({ assignedTo: OWNER });
    await expect(service.listQueue(ACTOR, OTHER_ORG)).rejects.toBeInstanceOf(AuthorizationError);
    for (const [name, operation] of clinicalOperations) {
      if (name === "claim") continue; // Claim is assignment creation; SQL checks submitted/unassigned state.
      await expect(operation(service)).rejects.toMatchObject({ statusCode: name === "cancel" ? 404 : 403 });
    }
    await expect(service.detail(ACTOR, CASE, "user")).rejects.toMatchObject({ statusCode: 404 });
    expect(rpc).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it("keeps the configured application eligibility guard ahead of professional access", async () => {
    const { app, decide, from } = harness();
    decide.mockResolvedValue({ decision: "ACCOUNT_SUSPENDED" });
    const response = await request(app).get(`/api/v1/professional/organizations/${ORG}/queue`).set("Authorization", "Bearer mfa");
    expect(response.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it("ignores forged actor, role and organization values on a claim", async () => {
    const { app, rpc } = harness({ member: null });
    const response = await request(app).post(`/api/v1/professional/cases/${CASE}/claim`)
      .set("Authorization", "Bearer mfa").send({ userId: OWNER, role: "counselor", organizationId: ORG, membershipId: MEMBER });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("RESOURCE_FORBIDDEN");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["get", "organizations"], ["get", `organizations/${ORG}/memberships`], ["get", `organizations/${ORG}/audit`],
    ["post", "organizations"], ["post", `organizations/${ORG}/approve`], ["post", `organizations/${ORG}/suspend`],
    ["post", "memberships"], ["post", `memberships/${MEMBER}/suspend`],
  ] as const)("denies an org_admin access to application admin %s %s", async (method, path) => {
    const { app, assertAdmin, from, rpc } = harness({ member: { ...approved, role: "org_admin" } });
    const response = await request(app)[method](`/api/v1/professional/admin/${path}`)
      .set("Authorization", "Bearer mfa").send({ userId: OWNER, role: "org_admin", membershipId: MEMBER });
    expect(response.status).toBe(403);
    expect(assertAdmin).toHaveBeenCalledWith(ACTOR);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("appointment cancellation assurance", () => {
  it("rejects practitioner aal1 even when body, query and headers claim ownership or MFA", async () => {
    const { app, rpc } = harness();
    const response = await request(app).post(`/api/v1/professional/appointments/${APPOINTMENT}/cancel?assuranceLevel=aal2&userId=${OWNER}`)
      .set("Authorization", "Bearer basic").set("X-Assurance-Level", "aal2")
      .send({ assuranceLevel: "aal2", userId: OWNER, owner: true });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MFA_REQUIRED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when a practitioner has no verified assurance", async () => {
    const { service, rpc } = harness();
    await expect(service.cancelAppointment(ACTOR, APPOINTMENT, undefined)).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([["owner", OWNER], ["mfa", ACTOR]])("preserves authorized %s cancellation through the auditing RPC", async (token, actor) => {
    const { app, rpc } = harness({ member: token === "owner" ? null : approved });
    const response = await request(app).post(`/api/v1/professional/appointments/${APPOINTMENT}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ appointmentId: APPOINTMENT, status: "canceled" });
    expect(rpc).toHaveBeenCalledWith("cancel_appointment", { p_appointment_id: APPOINTMENT, p_actor: actor });
  });

  it("rejects an unrelated appointment identifier without mutation", async () => {
    const { app, rpc } = harness();
    const response = await request(app).post(`/api/v1/professional/appointments/${OTHER_ORG}/cancel`).set("Authorization", "Bearer mfa");
    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
});
