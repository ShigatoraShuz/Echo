import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
const path = `/api/v1/professional/cases/${ids.request}/crisis-support`;
function harness() {
  const state = { assignee: ids.actor, role: "counselor", status: "active", auditFails: false };
  const insert = vi.fn(async () => ({ error: state.auditFails ? { message: "Private SQL diagnostic" } : null }));
  const from = vi.fn((table: string) => {
    const query = { select: () => query, eq: () => query, insert, maybeSingle: async () => ({ error: null, data: table === "support_requests" ? { id: ids.request, organization_id: ids.org, assigned_to: state.assignee, status: "assigned" } : table === "memberships" ? { status: state.status, role: state.role, credential_expires_at: "2099-12-31" } : { status: "active" } }) }; return query;
  });
  const supportResources = vi.fn().mockResolvedValue([]);
  const service = new ProfessionalService({ schema: () => ({ from }) } as unknown as SupabaseClient, createEncryptionService(Buffer.alloc(32, 8).toString("base64"), 1), {} as JournalService, { supportResources });
  const app = createApp({ v1: { professionals: { service, verifier: { getUser: async (token) => ({ id: ids.actor, assuranceLevel: token === "mfa" ? "aal2" : "aal1" }) }, verificationService: {} as VerificationService } } });
  return { state, supportResources, app, insert, from };
}
describe("professional crisis support foundation", () => {
  it("reuses the reviewed directory with explicit unavailable escalation and no monitoring promise", async () => {
    const h = harness(); const response = await request(h.app).get(path).set("Authorization", "Bearer mfa");
    expect(response.status).toBe(200); expect(response.body.data).toEqual({ resources: [], country: "PH", continuouslyMonitored: false, escalation: { available: false, reasonCode: "ORGANIZATION_PROTOCOL_REQUIRED" } });
    expect(h.supportResources).toHaveBeenCalledWith(undefined, "crisis_hotline", "PH");
    expect(h.from.mock.calls.map(c => c[0])).not.toContain("shared_journals");
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ action: "crisis.resources_viewed", request_id: ids.request }));
  });
  it.each(["mfa", "assignment", "role", "membership"])("denies %s failure before directory access", async (kind) => {
    const h = harness(); if (kind === "assignment") h.state.assignee = ids.second; if (kind === "role") h.state.role = "coordinator"; if (kind === "membership") h.state.status = "suspended";
    expect((await request(h.app).get(path).set("Authorization", `Bearer ${kind === "mfa" ? "password" : "mfa"}`)).status).toBe(403); expect(h.supportResources).not.toHaveBeenCalled();
  });
  it("discards the directory response when eligibility changes mid-read", async () => {
    const h = harness(); h.supportResources.mockImplementation(async () => { h.state.status = "suspended"; return []; });
    expect((await request(h.app).get(path).set("Authorization", "Bearer mfa")).status).toBe(403);
  });
  it("fails closed on audit failure without returning diagnostics", async () => {
    const h = harness(); h.state.auditFails = true; const response = await request(h.app).get(path).set("Authorization", "Bearer mfa");
    expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain("Private SQL");
  });
  it("does not accept an invented escalation mutation or patient/location query", async () => {
    const h = harness(); expect((await request(h.app).post(path).set("Authorization", "Bearer mfa").send({ dispatch: true })).status).toBe(404);
    expect((await request(h.app).get(`${path}?patientId=${ids.owner}`).set("Authorization", "Bearer mfa")).status).toBe(400); expect(h.supportResources).not.toHaveBeenCalled();
  });
});
