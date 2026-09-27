import request from "supertest";
import express from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { endpointLimiter, trustedOrigins } from "../../src/shared/middleware/security-policy.js";
import { errorMiddleware } from "../../src/shared/middleware/error.middleware.js";

describe("central API hardening", () => {
  it("rejects hostile origins before body parsing and includes a request ID", async () => {
    const res = await request(createApp({ allowedOrigin: "https://echo.example" })).post("/api/v1/anything").set("Origin", "https://evil.example").send({ body: "private" });
    expect(res.status).toBe(403); expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("permits the exact configured origin and rejects unexpected preflight methods", async () => {
    const app = createApp({ allowedOrigin: "https://echo.example" });
    const allowed = await request(app).options("/api/v1/journals").set("Origin", "https://echo.example").set("Access-Control-Request-Method", "POST");
    expect(allowed.status).toBe(204); expect(allowed.headers["access-control-allow-origin"]).toBe("https://echo.example");
    expect((await request(app).options("/api/v1/journals").set("Origin", "https://echo.example").set("Access-Control-Request-Method", "TRACE")).status).toBe(403);
  });
  it("rejects spoofed proxy headers on a direct deployment", async () => {
    expect((await request(createApp()).get("/api/v1/health").set("X-Forwarded-For", "1.2.3.4")).status).toBe(400);
  });
  it("returns safe errors and security headers for oversized/malformed input", async () => {
    const app = createApp({ bodyLimit: "1kb" });
    const large = await request(app).post("/api/v1/journals").send({ content: "x".repeat(2000) });
    expect(large.status).toBe(413); expect(large.headers["x-content-type-options"]).toBe("nosniff");
    expect(large.headers["x-powered-by"]).toBeUndefined(); expect(large.body.meta.requestId).toBeTruthy();
    const malformed = await request(app).post("/api/v1/journals").set("Content-Type", "application/json").send('{"secret":');
    expect(malformed.status).toBe(400); expect(JSON.stringify(malformed.body)).not.toContain("secret");
  });
  it("limits a verified actor independently of claimed forwarded addresses", async () => {
    const app = express(); app.use((req, _res, next) => { req.auth = { id: "actor-a" }; next(); });
    app.get("/expensive", endpointLimiter(2), (_req, res) => res.json({ ok: true })); app.use(errorMiddleware);
    expect((await request(app).get("/expensive")).status).toBe(200);
    expect((await request(app).get("/expensive")).status).toBe(200);
    const rejected = await request(app).get("/expensive");
    expect(rejected.status).toBe(429); expect(rejected.body.error.code).toBe("RATE_LIMITED");
  });
  it("does not create hostname aliases for non-loopback frontend origins", () => {
    expect(trustedOrigins("https://localhost.echo.example")).toEqual(["https://localhost.echo.example"]);
    expect(() => trustedOrigins("https://echo.example/path")).toThrow();
  });
});
