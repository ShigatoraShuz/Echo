import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService, decryptText, encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { AuthorizationError } from "../../../shared/errors/app-error.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";

const USER = "fd000000-0000-4000-8000-000000000001";
const ADMIN = "fd000000-0000-4000-8000-000000000002";
const OTHER = "fd000000-0000-4000-8000-000000000003";
const ORG = "fd000000-0000-4000-8000-000000000004";
const ID = "fd000000-0000-4000-8000-000000000005";
const SECRET = "Synthetic licensing registry reference: confidential-reference-123";
const encryption = createEncryptionService(Buffer.alloc(32, 2).toString("base64"), 1);
const input = { organizationId: ORG, role: "counselor" as const, credentialLabel: "Synthetic credential", expiresAt: "2099-12-31", evidenceReference: SECRET };
const memberInput = { organizationId: ORG, userId: USER, role: "counselor" as const, displayName: "Synthetic Practitioner", credentialLabel: input.credentialLabel, credentialExpiresAt: input.expiresAt, credentialId: ID };
type Row = Record<string, unknown>;
function harness(override: Row = {}) {
  const row: Row = {
    id: ID, organization_id: ORG, user_id: USER, role: "counselor", credential_label: input.credentialLabel,
    expires_at: input.expiresAt, status: "approved", reviewed_by: ADMIN, reviewed_at: "2026-10-12T00:00:00Z",
    submitted_at: "2026-10-11T00:00:00Z", reason_code: null,
    evidence_reference_encrypted: encryptText(SECRET, encryption), ...override,
  };
  const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
  const upsert = vi.fn();
  const selections = vi.fn();
  const from = vi.fn((table: string) => {
    const filters: [string, unknown][] = [];
    const tableRow = table === "credential_reviews" ? row : table === "organizations"
      ? { id: ORG, status: "active" } : table === "profiles"
        ? { user_id: USER, account_status: "active", eligible_18_plus: true, onboarding_completed: true } : { id: ID };
    const result = () => filters.every(([key, value]) => (tableRow as Row)[key] === value) ? [tableRow] : [];
    const query = {
      select: (fields: string) => { selections(table, fields); return query; },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query, limit: () => query,
      upsert: (value: unknown) => { upsert(value); return query; },
      single: async () => ({ data: result()[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: result(), error: null }).then(resolve),
    };
    return query;
  });
  const service = new ProfessionalService({ schema: () => ({ from, rpc }) } as unknown as SupabaseClient, encryption, {} as JournalService);
  const assertAdmin = vi.fn(async (actor: string) => { if (actor !== ADMIN) throw new AuthorizationError(); });
  const app = createApp({ v1: { professionals: {
    service, verificationService: { assertAdmin } as unknown as VerificationService,
    verifier: { getUser: async (token: string) => ({
      id: token.startsWith("admin") ? ADMIN : USER,
      assuranceLevel: token.endsWith("basic") ? "aal1" : "aal2",
      authenticatedAt: Date.now() / 1000 - (token.endsWith("old") ? 700 : 0),
    }) },
  } } });
  return { app, service, rpc, upsert, selections, row };
}
afterEach(() => { vi.restoreAllMocks(); });
const base = `/api/v1/professional/admin/organizations/${ORG}/credentials`;

describe("professional credential evidence and HTTP boundaries", () => {
 it("corrects metadata through one owner-scoped RPC without a new application",async()=>{
  const {app,rpc}=harness({status:"pending",reviewed_by:null,reviewed_at:null});
  const result=await request(app).patch("/api/v1/professional/credentials/"+ID).set("Authorization","Bearer user").send({credentialLabel:"SYNTHETIC THESIS DEMO — NOT A LICENSE",expiresAt:"2099-12-31"});
  expect(result.status).toBe(200);expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith("correct_pending_credential",{p_actor:USER,p_credential_id:ID,p_label:"SYNTHETIC THESIS DEMO — NOT A LICENSE",p_expires_at:"2099-12-31"});expect(JSON.stringify(result.body)).not.toContain("evidence");
 });
 it("requires MFA and forbids forged owner/status/org correction fields",async()=>{
  const {app,rpc}=harness();const path="/api/v1/professional/credentials/"+ID;const input={credentialLabel:"Fictional correction",expiresAt:"2099-12-31"};
  expect((await request(app).patch(path).send(input)).status).toBe(401);
  expect((await request(app).patch(path).set("Authorization","Bearer user-basic").send(input)).status).toBe(403);
  for(const extra of [{userId:OTHER},{organizationId:OTHER},{status:"approved"},{expiresAt:"2020-01-01"}])expect((await request(app).patch(path).set("Authorization","Bearer user").send({...input,...extra})).status).toBeGreaterThanOrEqual(400);expect(rpc).not.toHaveBeenCalled();
 });
  it("encrypts evidence before persistence and returns metadata only after submission", async () => {
    const { app, rpc } = harness({ status: "pending", reviewed_by: null, reviewed_at: null });
    const response = await request(app).post("/api/v1/professional/credentials").set("Authorization", "Bearer user").send(input);
    expect(response.status).toBe(201);
    expect(response.body.data.credential.status).toBe("pending");
    const args = rpc.mock.calls[0][1];
    expect(args).toMatchObject({ p_actor: USER, p_organization_id: ORG, p_role: "counselor" });
    expect(decryptText(args.p_evidence_encrypted, encryption)).toBe(SECRET);
    expect(JSON.stringify(args)).not.toContain(SECRET);
    expect(JSON.stringify(response.body)).not.toContain("evidence");
  });

  it("scopes owner history and admin lists without selecting evidence", async () => {
    const { service, selections } = harness();
    expect((await service.credentials.listOwn(USER)).credentials).toHaveLength(1);
    expect((await service.credentials.listOwn(OTHER)).credentials).toEqual([]);
    expect((await service.credentials.listForAdmin(OTHER)).credentials).toEqual([]);
    expect((await service.credentials.listForAdmin(ORG)).credentials).toHaveLength(1);
    expect(JSON.stringify(selections.mock.calls)).not.toContain("evidence");
  });

  it.each(["pending", "approved", "rejected"])("projects expiration without rewriting %s review history", async (status) => {
    const { service } = harness({ expires_at: "2020-01-01", status });
    const row = (await service.credentials.listOwn(USER)).credentials[0];
    expect(row.status).toBe(status === "rejected" ? "rejected" : "expired");
    expect(row.reviewStatus).toBe(status);
  });

  it("rejects expired evidence before persistence", async () => {
    const { app, rpc } = harness();
    const response = await request(app).post("/api/v1/professional/credentials").set("Authorization", "Bearer user").send({ ...input, expiresAt: "2020-01-01" });
    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { userId: ADMIN }, { reviewedBy: ADMIN }, { status: "approved" }, { role: "org_admin" }, { expiresAt: "invalid" },
  ])("rejects forged or invalid submission fields %j", async (extra) => {
    const { app, rpc } = harness();
    const response = await request(app).post("/api/v1/professional/credentials").set("Authorization", "Bearer user").send({ ...input, ...extra });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires authentication and MFA before accepting credential evidence", async () => {
    const { app, rpc } = harness();
    expect((await request(app).post("/api/v1/professional/credentials").send(input)).status).toBe(401);
    expect((await request(app).post("/api/v1/professional/credentials").set("Authorization", "Bearer user-basic").send(input)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["user", "admin-basic", "admin-old"])("denies review operations to %s", async (token) => {
    const { app, rpc } = harness();
    for (const path of [base, `${base}/${ID}`]) {
      expect((await request(app).get(path).set("Authorization", `Bearer ${token}`)).status).toBe(403);
    }
    expect((await request(app).post(`${base}/${ID}/decision`).set("Authorization", `Bearer ${token}`).send({ decision: "approved", reasonCode: null })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("delivers decrypted evidence only through an authorized, audited review RPC", async () => {
    const { app, rpc } = harness();
    const response = await request(app).get(`${base}/${ID}`).set("Authorization", "Bearer admin");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body.data.credential.evidenceReference).toBe(SECRET);
    expect(rpc).toHaveBeenCalledWith("read_credential_for_review", { p_actor: ADMIN, p_organization_id: ORG, p_credential_id: ID });
  });

  it.each([
    { decision: "approved", reasonCode: null, reviewedBy: OTHER },
    { decision: "approved", reasonCode: null, expiresAt: "2099-12-31" },
    { decision: "rejected", reasonCode: null },
    { decision: "approved", reasonCode: "invalid_evidence" },
  ])("rejects forged reviewer fields or invalid decision %j", async (input) => {
    const { app, rpc } = harness();
    expect((await request(app).post(`${base}/${ID}/decision`).set("Authorization", "Bearer admin").send(input)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the verified reviewer and keeps decision responses free of evidence", async () => {
    const { app, rpc } = harness();
    const response = await request(app).post(`${base}/${ID}/decision`).set("Authorization", "Bearer admin").send({ decision: "approved", reasonCode: null });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("review_credential", expect.objectContaining({ p_actor: ADMIN, p_decision: "approved" }));
    expect(JSON.stringify(response.body)).not.toContain("evidence");
  });

  it.each([
    ["CREDENTIAL_SELF_REVIEW", 403], ["CREDENTIAL_FORBIDDEN", 403], ["CREDENTIAL_UNAVAILABLE", 404],
    ["CREDENTIAL_EXPIRED", 409], ["CREDENTIAL_ALREADY_REVIEWED", 409],
  ])("preserves safe rejection of %s", async (message, status) => {
    const { app, rpc } = harness();
    rpc.mockResolvedValue({ data: null, error: { message } });
    const response = await request(app).post(`${base}/${ID}/decision`).set("Authorization", "Bearer admin").send({ decision: "approved", reasonCode: null });
    expect(response.status).toBe(status);
    expect(JSON.stringify(response.body)).not.toContain(SECRET);
  });

  it("keeps sensitive database diagnostics out of responses and application logs", async () => {
    const { app, rpc } = harness();
    const logs = [vi.spyOn(console, "error").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "info").mockImplementation(() => {})];
    rpc.mockResolvedValue({ data: null, error: { message: SECRET, details: SECRET, hint: SECRET } });
    const response = await request(app).get(`${base}/${ID}`).set("Authorization", "Bearer admin");
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain(SECRET);
    expect(JSON.stringify(logs.map((log) => log.mock.calls))).not.toContain(SECRET);
  });
});

describe("credential-backed clinical membership provisioning", () => {
  it("links a matching approved review while preserving existing membership checks", async () => {
    const { service, upsert } = harness();
    await expect(service.approveMember(ADMIN, memberInput)).resolves.toEqual({ membershipId: ID });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ approved_credential_id: ID, approved_by: ADMIN, user_id: USER }));
  });

  it.each([
    { status: "pending" }, { status: "rejected" }, { expires_at: "2020-01-01" },
    { organization_id: OTHER }, { user_id: OTHER }, { role: "psychologist" },
    { credential_label: "Another label" }, { reviewed_by: USER }, { reviewed_by: null },
  ])("denies unapproved, mismatched or expired review %j", async (override) => {
    const { service, upsert } = harness(override);
    await expect(service.approveMember(ADMIN, memberInput)).rejects.toBeInstanceOf(AuthorizationError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("blocks self-approval and the legacy credentialChecked-only clinical path", async () => {
    const { service, upsert } = harness();
    await expect(service.approveMember(USER, memberInput)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(service.approveMember(ADMIN, { ...memberInput, credentialId: undefined })).rejects.toBeInstanceOf(AuthorizationError);
    expect(upsert).not.toHaveBeenCalled();
  });
});
