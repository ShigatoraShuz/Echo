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
  it("finishes password-only signup without leaving unusable draft cookies", async () => {
    const { app, service } = harness();
    service.registerEmail.mockResolvedValue(null);
    const response = await request(app)
      .post("/api/v1/registration/email")
      .set("Origin", "http://localhost:3000")
      .send({ email: "synthetic@example.test", password: "StrongPass1", confirmPassword: "StrongPass1" });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ nextStep: "sign-in", verificationPending: false });
    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });
  it("rejects state changes from an untrusted origin", async () => {
    const { app, service } = harness();
    const response = await request(app)
      .post("/api/v1/registration/eligibility")
      .set("Origin", "https://attacker.example")
      .send({ birthday: "1990-01-01" });
    expect(response.status).toBe(403);
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
