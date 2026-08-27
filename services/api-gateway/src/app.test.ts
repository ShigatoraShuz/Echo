import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signUserContext } from "@echo/service-core";
import { createGatewayApp } from "./app.js";

const config = {
  NODE_ENV: "test" as const, PORT: 4200, FRONTEND_URL: "http://localhost:3000",
  SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key",
  USER_SERVICE_TOKEN: "u".repeat(32), JOURNAL_SERVICE_TOKEN: "j".repeat(32),
  ASSESSMENT_SERVICE_TOKEN: "s".repeat(32), ANALYSIS_SERVICE_TOKEN: "a".repeat(32),
  RECOMMENDATION_SERVICE_TOKEN: "r".repeat(32), WELLNESS_SERVICE_TOKEN: "w".repeat(32),
  INSIGHTS_SERVICE_TOKEN: "i".repeat(32), REQUEST_TIMEOUT_MS: 1000,
  USER_SERVICE_URL: "http://user", JOURNAL_SERVICE_URL: "http://journal",
  ASSESSMENT_SERVICE_URL: "http://assessment", ANALYSIS_SERVICE_URL: "http://analysis",
  RECOMMENDATION_SERVICE_URL: "http://recommendation", WELLNESS_SERVICE_URL: "http://wellness",
  INSIGHTS_SERVICE_URL: "http://insights",
};

describe("API gateway", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("routes journals and propagates a request id plus signed user context", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await request(createGatewayApp(config, async () => ({ id: "00000000-0000-4000-8000-000000000001" })))
      .get("/api/v1/journals").set("authorization", "Bearer user-token");
    expect(response.status).toBe(200);
    expect(String(upstream.mock.calls[0]?.[0])).toBe("http://journal/api/v1/journals");
    const headers = upstream.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-request-id")).toBe(response.headers["x-request-id"]);
    expect(headers.get("x-echo-signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(headers.get("x-echo-signature")).toBe(signUserContext({
      requestId: headers.get("x-request-id")!,
      userId: headers.get("x-echo-user")!,
      timestamp: headers.get("x-echo-timestamp")!,
      secret: config.JOURNAL_SERVICE_TOKEN,
    }));
  });
  it("routes analysis separately from journal CRUD", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);
    await request(createGatewayApp(config, async () => ({ id: "00000000-0000-4000-8000-000000000001" })))
      .post("/api/v1/journals/00000000-0000-4000-8000-000000000002/analyze").set("authorization", "Bearer user-token");
    expect(String(upstream.mock.calls[0]?.[0])).toContain("http://analysis/");
  });
  it("fails closed on invalid auth", async () => {
    const response = await request(createGatewayApp(config, async () => null)).get("/api/v1/journals").set("authorization", "Bearer bad");
    expect(response.status).toBe(401);
  });
  it("maps unavailable upstreams to 503", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const response = await request(createGatewayApp(config, async () => ({ id: "00000000-0000-4000-8000-000000000001" })))
      .get("/api/v1/journals").set("authorization", "Bearer user-token");
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
  it("maps upstream timeouts to 504", async () => {
    const timeout = Object.assign(new Error("slow"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    const response = await request(createGatewayApp(config, async () => ({ id: "00000000-0000-4000-8000-000000000001" })))
      .get("/api/v1/journals").set("authorization", "Bearer user-token");
    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe("UPSTREAM_TIMEOUT");
  });
  it.each([400, 404, 422, 500, 503])("preserves upstream %s responses", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "UPSTREAM", message: "failure" } }), { status, headers: { "content-type": "application/json" } })));
    const response = await request(createGatewayApp(config, async () => ({ id: "00000000-0000-4000-8000-000000000001" })))
      .get("/api/v1/journals").set("authorization", "Bearer user-token");
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe("UPSTREAM");
  });
  it("returns 404 for unknown routes without calling an upstream", async () => {
    const response = await request(createGatewayApp(config, async () => ({ id: "00000000-0000-4000-8000-000000000001" })))
      .get("/api/v1/unknown").set("authorization", "Bearer user-token");
    expect(response.status).toBe(404);
  });
});
