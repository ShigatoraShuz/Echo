import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { ProfessionalService } from "../professional.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
function harness() {
  const operation = vi.fn().mockResolvedValue({ items: [] });
  const verifier = { getUser: vi.fn(async (token: string) => token === "synthetic-revoked" ? null : { id: token === "synthetic-second" ? ids.second : ids.actor, assuranceLevel: "aal2" as const }) };
  const sink = vi.fn().mockResolvedValue(undefined);
  const service = { followUps: { list: operation, create: operation, update: operation }, referrals: { list: operation, setStatus: operation }, notifications: { list: operation, read: operation }, crisisSupport: operation } as unknown as ProfessionalService;
  const app = createApp({ allowedOrigin: "https://echo.example", securityAuditSink: sink, v1: { professionals: { service, verifier, verificationService: {} as VerificationService } } });
  return { app, operation, verifier, sink };
}
const path = `/api/v1/professional/cases/${ids.request}/follow-ups`;
describe("BE-027 professional boundary security regressions", () => {
  it("rejects cookie-only CSRF attempts; a cookie never substitutes for a verified bearer token", async () => {
    const h = harness(); const response = await request(h.app).post(path).set("Origin", "https://echo.example").set("Cookie", "session=synthetic-private-cookie").send({ title: "Synthetic private title" });
    expect(response.status).toBe(401); expect(h.verifier.getUser).not.toHaveBeenCalled(); expect(h.operation).not.toHaveBeenCalled();
  });
  it("rejects hostile origins before protected services even with a bearer", async () => {
    const h = harness(); const response = await request(h.app).post(path).set("Origin", "https://untrusted.invalid").set("Authorization", "Bearer synthetic-token").send({ title: "Synthetic private title" });
    expect(response.status).toBe(403); expect(h.operation).not.toHaveBeenCalled(); expect(JSON.stringify(h.sink.mock.calls)).not.toMatch(/synthetic-token|Synthetic private|untrusted/);
  });
  it("enforces the real shared professional limiter by verified actor", async () => {
    const h = harness(); for (let i = 0; i < 45; i++) expect((await request(h.app).get(path).set("Authorization", "Bearer synthetic-token")).status).toBe(200);
    const response = await request(h.app).get(path).set("Authorization", "Bearer synthetic-token").set("X-User-Id", ids.second);
    expect(response.status).toBe(429); expect(response.body.error.code).toBe("RATE_LIMITED"); expect(h.operation).toHaveBeenCalledTimes(45);
    expect((await request(h.app).get(path).set("Authorization", "Bearer synthetic-second")).status).toBe(200);
    expect(h.sink).toHaveBeenCalledWith(expect.objectContaining({ event: "rate_limit.denied", outcome: "denied" }));
  });
  it.each([`/cases/${ids.request}/follow-ups`, `/cases/${ids.request}/referrals`, `/cases/${ids.request}/crisis-support`, `/organizations/${ids.org}/notifications`])("denies revoked sessions on %s", async (suffix) => {
    const h = harness(); expect((await request(h.app).get(`/api/v1/professional${suffix}`).set("Authorization", "Bearer synthetic-revoked")).status).toBe(401); expect(h.operation).not.toHaveBeenCalled();
  });
  it("keeps professional responses uncached and audit payloads free of case URLs or bearer text", async () => {
    const h = harness(); const response = await request(h.app).get(path).set("Authorization", "Bearer synthetic-private-token");
    expect(response.status).toBe(200); expect(response.headers["cache-control"]).toBe("no-store"); expect(response.headers.pragma).toBe("no-cache");
    expect(JSON.stringify(h.sink.mock.calls)).not.toMatch(new RegExp(`${ids.request}|${ids.actor}|synthetic-private-token`));
  });
  it("rejects spoofed forwarding and malformed resource identifiers before service invocation", async () => {
    const h = harness(); expect((await request(h.app).get(path).set("Authorization", "Bearer synthetic-token").set("X-Forwarded-For", "192.0.2.1")).status).toBe(400);
    expect((await request(h.app).get("/api/v1/professional/cases/not-a-uuid/follow-ups").set("Authorization", "Bearer synthetic-token")).status).toBe(400); expect(h.operation).not.toHaveBeenCalled();
  });
});
