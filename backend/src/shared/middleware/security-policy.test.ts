import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { trustedOrigins } from "./security-policy.js";
import { createApp } from "../../app.js";

const privateOrigin = "https://echo.example.ts.net";
afterEach(() => vi.unstubAllEnvs());

describe("private server local origin access", () => {
  it("permits both exact local frontends alongside the configured private origin in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(trustedOrigins(privateOrigin)).toEqual([privateOrigin, "http://127.0.0.1:3000", "http://localhost:3000"]);
  });
  it("does not broaden production or unrelated HTTPS origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(trustedOrigins(privateOrigin)).toEqual([privateOrigin]);
    vi.stubEnv("NODE_ENV", "development");
    expect(trustedOrigins("https://echo.example.test")).toEqual(["https://echo.example.test"]);
    expect(trustedOrigins("https://echo.ts.net.attacker.test")).toEqual(["https://echo.ts.net.attacker.test"]);
  });
  it("retains ordinary local startup aliases and exact ports", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(trustedOrigins("http://localhost:3000")).toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
    expect(trustedOrigins()).toEqual([]);
  });
  it("allows local presence preflight but rejects other ports and remote sites", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const app = createApp({ allowedOrigin: privateOrigin });
    for (const origin of [privateOrigin, "http://127.0.0.1:3000", "http://localhost:3000"]) {
      const response = await request(app).options("/api/v1/session/presence").set("Origin", origin)
        .set("Access-Control-Request-Method", "POST").set("Access-Control-Request-Headers", "authorization,content-type");
      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
    }
    for (const origin of ["http://127.0.0.1:3001", "https://attacker.test"]) {
      expect((await request(app).options("/api/v1/session/presence").set("Origin", origin).set("Access-Control-Request-Method", "POST")).status).toBe(403);
    }
  });
});
