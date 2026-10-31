import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createSupabaseAccessTokenVerifier } from "../../../infrastructure/supabase/supabase-admin.client.js";
import type { VerificationService } from "../../verification/verification.service.js";
import type { ProfessionalService } from "../professional.service.js";

const ACTOR = "fc000000-0000-4000-8000-000000000001";
const ID = "fc000000-0000-4000-8000-000000000002";
const now = Math.floor(Date.now() / 1000);
const claims = { sub: ACTOR, iss: "https://synthetic.invalid/auth/v1", aud: "authenticated", role: "authenticated", exp: now + 300, iat: now, session_id: ID, aal: "aal2", amr: [{ method: "totp", timestamp: now }] };
// Synthetic bytes are accepted only by the explicit Auth double below. The
// production verifier/middleware still runs; no real signature or session exists.
function bearer(overrides: object = {}) { return `e30.${Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString("base64url")}.c3ludGhldGlj`; }
function harness() {
  const auth = vi.fn().mockResolvedValue({ data: { user: { id: ACTOR } }, error: null });
  const session = vi.fn().mockResolvedValue({ data: true, error: null });
  const verifier = createSupabaseAccessTokenVerifier({ auth: { getUser: auth }, schema: () => ({ rpc: session }) } as unknown as SupabaseClient, "https://synthetic.invalid");
  const operation = vi.fn().mockResolvedValue({});
  const assertAdmin = vi.fn().mockResolvedValue(undefined);
  const service = { dashboard: operation, listQueue: operation, detail: operation, claim: operation, addNote: operation, addReferral: operation, close: operation, proposeAppointment: operation, listOrganizationsForAdmin: operation, credentials: { listOwn: operation, submit: operation } };
  const app = createApp({ v1: { professionals: { service: service as unknown as ProfessionalService, verifier, verificationService: { assertAdmin } as unknown as VerificationService } } });
  return { app, operation, auth, session, assertAdmin };
}
const protectedActions = [
  ["get", `/organizations/${ID}/queue`, undefined], ["get", `/cases/${ID}`, undefined],
  ["get", `/organizations/${ID}/dashboard`, undefined],
  ["post", `/appointments/${ID}/reschedule`, {}],
  ["post", `/cases/${ID}/claim`, {}], ["post", `/cases/${ID}/notes`, { body: "Synthetic note" }],
  ["post", `/cases/${ID}/referrals`, { resourceName: "Synthetic resource", resourceUrl: null }],
  ["post", `/cases/${ID}/close`, {}], ["get", "/credentials", undefined],
] as const;

describe("BE-007 professional routes with the configured session verifier", () => {
  it.each(protectedActions)("rejects insufficient assurance for %s %s before service access", async (method, path, body) => {
    const h = harness();
    const response = await request(h.app)[method](`/api/v1/professional${path}`).set("Authorization", `Bearer ${bearer({ aal: "aal1" })}`).set("x-assurance-level", "aal2").send(body);
    expect(response.status).toBe(403); expect(response.body.error.code).toBe("MFA_REQUIRED");
    expect(h.operation).not.toHaveBeenCalled();
    expect(h.session).toHaveBeenCalledWith("security_session_active", { p_user_id: ACTOR, p_session_id: ID });
  });
  it.each(["expired", "revoked", "outage", "signature"])("denies a %s session before protected mutations", async (kind) => {
    const h = harness();
    if (kind === "revoked") h.session.mockResolvedValue({ data: false, error: null });
    if (kind === "outage") h.session.mockRejectedValue(new Error("Synthetic private diagnostic"));
    if (kind === "signature") h.auth.mockResolvedValue({ data: { user: null }, error: {} });
    const response = await request(h.app).post(`/api/v1/professional/cases/${ID}/claim`).set("Authorization", `Bearer ${bearer(kind === "expired" ? { exp: now - 1 } : {})}`);
    expect(response.status).toBe(401); expect(h.operation).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain("private diagnostic");
  });
  it("rechecks session revocation on the next request instead of caching authorization", async () => {
    const h = harness(); const token = bearer();
    expect((await request(h.app).get(`/api/v1/professional/cases/${ID}`).set("Authorization", `Bearer ${token}`)).status).toBe(200);
    h.session.mockResolvedValue({ data: false, error: null });
    expect((await request(h.app).post(`/api/v1/professional/cases/${ID}/claim`).set("Authorization", `Bearer ${token}`)).status).toBe(401);
    expect(h.operation).toHaveBeenCalledTimes(1);
  });
  it("does not treat token refresh as recent authentication for administrator actions", async () => {
    const h = harness();
    const response = await request(h.app).get("/api/v1/professional/admin/organizations")
      .set("Authorization", `Bearer ${bearer({ amr: [{ method: "password", timestamp: now - 7200 }] })}`);
    expect(response.status).toBe(403); expect(response.body.error.code).toBe("REAUTHENTICATION_REQUIRED");
    expect(h.assertAdmin).not.toHaveBeenCalled(); expect(h.operation).not.toHaveBeenCalled();
  });
});
