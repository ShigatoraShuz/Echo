import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { RegistrationService } from "../registration.service.js";

function harness() {
  const service = {
    activePolicies: vi.fn().mockResolvedValue([{ id: "p1" }, { id: "p2" }, { id: "p3" }]),
    startEligibility: vi
      .fn()
      .mockResolvedValue({ eligible: true, credentials: { token: "draft-secret", csrf: "csrf-secret" } }),
    acceptAgreements: vi.fn(),
    registerEmail: vi.fn(),
    registrationStatus: vi.fn(),
    createGoogleNonce: vi.fn(),
    bindGoogleSignup: vi.fn(),
    googleLoginStatus: vi.fn(),
  };
  const app = createApp({
    allowedOrigin: "http://localhost:3000",
    v1: {
      registration: { service: service as unknown as RegistrationService, allowedOrigin: "http://localhost:3000" },
    },
  });
  return { app, service };
}

describe("registration routes", () => {
  it("rejects state changes from an untrusted origin", async () => {
    const { app, service } = harness();
    const response = await request(app)
      .post("/api/v1/registration/eligibility")
      .set("Origin", "https://attacker.example")
      .send({ birthday: "1990-01-01" });
    expect(response.status).toBe(400);
    expect(service.startEligibility).not.toHaveBeenCalled();
  });
  it("sets a path-scoped HttpOnly draft and a readable CSRF cookie with secure attributes", async () => {
    const { app } = harness();
    const response = await request(app)
      .post("/api/v1/registration/eligibility")
      .set("Origin", "http://localhost:3000")
      .send({ birthday: "1990-01-01" });
    expect(response.status).toBe(200);
    const values = response.headers["set-cookie"] as unknown as string[];
    expect(values[0]).toContain("HttpOnly");
    expect(values[0]).toContain("Secure");
    expect(values[0]).toContain("SameSite=Lax");
    expect(values[0]).toContain("Path=/api/v1/registration");
    expect(values[1]).not.toContain("HttpOnly");
    expect(values[1]).toContain("Path=/");
  });
  it("rate limits repeated pre-auth requests", async () => {
    const { app } = harness();
    let response;
    for (let index = 0; index < 13; index++)
      response = await request(app)
        .post("/api/v1/registration/eligibility")
        .set("Origin", "http://localhost:3000")
        .send({ birthday: "1990-01-01" });
    expect(response?.status).toBe(429);
  });
});
