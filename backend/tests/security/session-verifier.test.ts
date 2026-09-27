import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import express from "express";
import { createSupabaseAccessTokenVerifier } from "../../src/infrastructure/supabase/supabase-admin.client.js";
import { requireMfa, requireRecentAuthentication } from "../../src/shared/middleware/assurance.middleware.js";
import { errorMiddleware } from "../../src/shared/middleware/error.middleware.js";

const now = Math.floor(Date.now() / 1000);
const base = { sub: "user-a", iss: "https://test.supabase.co/auth/v1", aud: "authenticated", role: "authenticated", exp: now + 300,
  iat: now, session_id: "10000000-0000-4000-8000-000000000001", aal: "aal2", amr: [{ method: "totp", timestamp: now - 10 }] };
function token(claims: object) { return `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.c2ln`; }
function harness() {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-a", email_confirmed_at: "2026-09-17" } }, error: null });
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const client = { auth: { getUser }, schema: vi.fn(() => ({ rpc })) };
  return { getUser, rpc, verify: createSupabaseAccessTokenVerifier(client as unknown as SupabaseClient, "https://test.supabase.co") };
}
describe("configured token verification and revocation", () => {
  it.each([
    { exp: now - 1 }, { iss: "https://wrong.supabase.co/auth/v1" }, { aud: "service_role" }, { role: "service_role" },
    { session_id: undefined }, { session_id: "invalid" }, { iat: now + 3600 }, { nbf: now + 60 },
  ])("rejects invalid claims %j before remote verification", async (override) => {
    const h = harness();
    expect(await h.verify.getUser(token({ ...base, ...override }))).toBeNull();
    expect(h.getUser).not.toHaveBeenCalled();
  });
  it("never trusts claims when the Auth signature verifier rejects them", async () => {
    const h = harness(); h.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    expect(await h.verify.getUser(token(base))).toBeNull(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("rejects revoked sessions and database outages", async () => {
    const h = harness();
    for (const response of [{ data: false, error: null }, { data: null, error: {} }]) {
      h.rpc.mockResolvedValue(response); expect(await h.verify.getUser(token(base))).toBeNull();
    }
  });
  it("returns assurance only after signature and session checks", async () => {
    const h = harness();
    expect(await h.verify.getUser(token(base))).toMatchObject({ id: "user-a", assuranceLevel: "aal2", authenticatedAt: now - 10 });
    expect(h.rpc).toHaveBeenCalledWith("security_session_active", { p_user_id: "user-a", p_session_id: base.session_id });
  });
  it("does not mistake token refresh for recent authentication", async () => {
    const h = harness();
    expect((await h.verify.getUser(token({ ...base, amr: [{ method: "password", timestamp: now - 7200 }] })))?.authenticatedAt).toBe(now - 7200);
  });
});
describe("privileged assurance gates", () => {
  it.each([
    ["aal1", now, 403], ["aal2", now - 7200, 403], ["aal2", undefined, 403], ["aal2", now + 100, 403], ["aal2", now, 200],
  ])("enforces MFA and recent authentication (%s, %s)", async (aal, authenticatedAt, status) => {
    const app = express();
    app.use((req, _res, next) => { req.auth = { id: "user-a", assuranceLevel: aal as "aal1" | "aal2", authenticatedAt: authenticatedAt as number | undefined }; next(); });
    app.get("/privileged", requireMfa, requireRecentAuthentication, (_req, res) => res.json({ ok: true }));
    app.use(errorMiddleware);
    expect((await request(app).get("/privileged")).status).toBe(status);
  });
});
