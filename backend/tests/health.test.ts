import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("health endpoints", () => {
  it("returns the standardized health response", async () => {
    const response = await request(createApp()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok", service: "backend" },
    });
    expect(response.body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("returns a safe standardized 404 response", async () => {
    const response = await request(createApp()).get("/api/v1/missing");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("applies browser and error-safety middleware without exposing request data", async () => {
    const app = createApp({ allowedOrigin: "http://localhost:3000" });
    const allowedOrigin = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000");

    expect(allowedOrigin.status).toBe(200);
    expect(allowedOrigin.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowedOrigin.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowedOrigin.headers["cache-control"]).toBe("no-store");
    expect(allowedOrigin.headers["x-powered-by"]).toBeUndefined();

    const notFound = await request(app).get("/api/v1/not-a-real-route?token=do-not-log-me");
    expect(JSON.stringify(notFound.body)).not.toContain("do-not-log-me");
    expect(notFound.body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("rate limits repeated requests", async () => {
    const app = createApp();
    let limited = false;
    for (let attempt = 0; attempt < 125; attempt += 1) {
      const response = await request(app).get("/api/v1/health");
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
