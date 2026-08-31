import request from "supertest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const origin = "http://127.0.0.1:3000";
const prefix = "/api/v1/registration/google";
const fixtureToken = "test-token-not-sent-to-google".padEnd(120, "x");

async function harness() {
  // Isolate the router's rate-limit store for each independent scenario.
  const { createApp } = await import("../../../app.js");
  const { RegistrationService } = await import("../registration.service.js");
  const db = {} as SupabaseClient;
  const service = new RegistrationService(db, db, "test-only-signup-secret", "test-client", origin);
  const verifyIdentity = vi.spyOn(service, "googleLoginStatus").mockResolvedValue({
    status: "existing_google_identity",
    identity: { sub: "test-subject", email: "test@example.com" },
  });
  const app = createApp({ allowedOrigin: origin, v1: { registration: { service, allowedOrigin: origin } } });
  return { app, agent: request.agent(app), service, verifyIdentity };
}

describe("Google login challenge cookie transport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("round-trips a real signed challenge using HTTP cookies on direct development loopback", async () => {
    const { agent, verifyIdentity } = await harness();
    const challenge = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).send({});
    const header = challenge.headers["set-cookie"][0] as string;
    expect(challenge.status).toBe(200);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/api/v1/registration");
    expect(header).toContain("Max-Age=300");
    expect(header).not.toContain("Secure");
    const confirmation = await agent
      .post(`${prefix}/login-challenge`)
      .set("Origin", origin)
      .send({ nonce: challenge.body.data.nonce });
    expect(confirmation.status).toBe(200);
    expect(confirmation.body.data).toEqual({ ready: true });
    expect(verifyIdentity).not.toHaveBeenCalled();
    const result = await agent
      .post(`${prefix}/login-status`)
      .set("Origin", origin)
      .send({ idToken: fixtureToken, nonce: challenge.body.data.nonce });
    expect(result.status).toBe(200);
    expect(verifyIdentity).toHaveBeenCalledOnce();
    expect(result.headers["set-cookie"][0]).toContain("Max-Age=0");
  });

  it("keeps two pending login attempts valid without overwriting either challenge", async () => {
    const { agent, verifyIdentity } = await harness();
    const first = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).send({});
    const second = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).send({});
    expect(first.headers["set-cookie"][0].split("=")[0]).not.toBe(second.headers["set-cookie"][0].split("=")[0]);
    for (const challenge of [first, second]) {
      const result = await agent
        .post(`${prefix}/login-status`)
        .set("Origin", origin)
        .send({ idToken: fixtureToken, nonce: challenge.body.data.nonce });
      expect(result.status).toBe(200);
    }
    expect(verifyIdentity).toHaveBeenCalledTimes(2);
  });

  it("always retains Secure in production, including loopback origins", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { agent } = await harness();
    const result = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).send({});
    expect(result.headers["set-cookie"][0]).toContain("Secure");
  });

  it("does not relax Secure for a non-loopback hostname in development", async () => {
    const { agent } = await harness();
    const result = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).set("Host", "echo.example").send({});
    expect(result.headers["set-cookie"][0]).toContain("Secure");
  });

  it("reports missing cookies without processing tokens or leaking challenge data", async () => {
    const { agent, verifyIdentity } = await harness();
    const confirmation = await agent
      .post(`${prefix}/login-challenge`)
      .set("Origin", origin)
      .send({ nonce: "missing-cookie-challenge" });
    expect(confirmation.status).toBe(400);
    expect(confirmation.body.error.code).toBe("GOOGLE_CHALLENGE_MISSING");
    const result = await agent
      .post(`${prefix}/login-status`)
      .set("Origin", origin)
      .send({ idToken: fixtureToken, nonce: "missing-cookie-challenge" });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("GOOGLE_CHALLENGE_MISSING");
    expect(result.body.error.message).toContain("cookie was not received");
    expect(JSON.stringify(result.body)).not.toContain(fixtureToken);
    expect(verifyIdentity).not.toHaveBeenCalled();
  });

  it("rejects swapping one attempt's proof into another attempt's cookie", async () => {
    const { app, agent, verifyIdentity } = await harness();
    const first = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).send({});
    const second = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).send({});
    const name = second.headers["set-cookie"][0].split("=")[0];
    const proof = first.headers["set-cookie"][0].split(";")[0].split("=")[1];
    const result = await request(app)
      .post(`${prefix}/login-status`)
      .set("Origin", origin)
      .set("Cookie", `${name}=${proof}`)
      .send({ idToken: fixtureToken, nonce: second.body.data.nonce });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("GOOGLE_CHALLENGE_INVALID");
    expect(verifyIdentity).not.toHaveBeenCalled();
  });

  it("rejects an expired signed proof with an actionable error", async () => {
    const { app, agent, verifyIdentity } = await harness();
    const challenge = await agent.post(`${prefix}/login-nonce`).set("Origin", origin).send({});
    const cookie = challenge.headers["set-cookie"][0].split(";")[0];
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 301_000);
    const result = await request(app)
      .post(`${prefix}/login-status`)
      .set("Origin", origin)
      .set("Cookie", cookie)
      .send({ idToken: fixtureToken, nonce: challenge.body.data.nonce });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("GOOGLE_CHALLENGE_EXPIRED");
    expect(verifyIdentity).not.toHaveBeenCalled();
  });
});
