import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gatewayUserHeaders } from "@echo/service-core";
import { createWellnessApp } from "./app.js";
import { hasUrgentLanguage } from "./wellness.service.js";

const options = { serviceToken: "w".repeat(32), userServiceToken: "u".repeat(32), userServiceUrl: "http://user", timeoutMs: 100 };
const service = new Proxy({}, { get: () => async () => [] }) as any;

describe("wellness service", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("has independent health", async () => expect((await request(createWellnessApp(service, options)).get("/health")).status).toBe(200));
  it.each(["kill myself", "end my life", "suicide plan", "want to die", "hurt myself"])("aligns Buddy urgent-language detection for %s", (phrase) => expect(hasUrgentLanguage(`I ${phrase} tonight`)).toBe(true));
  it("does not flag non-urgent reflection", () => expect(hasUrgentLanguage("I felt disconnected today")).toBe(false));

  it("passes the selected conversation ID to the owner-scoped service method", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { approved: true } }), { status: 200, headers: { "content-type": "application/json" } })));
    const session = vi.fn().mockResolvedValue({ conversationId: "00000000-0000-4000-8000-000000000042", messages: [] });
    const scopedService = new Proxy({}, { get: (_target, property) => property === "session" ? session : async () => [] }) as any;
    const requestId = "00000000-0000-4000-8000-000000000043";
    const userId = "00000000-0000-4000-8000-000000000044";
    const response = await request(createWellnessApp(scopedService, options))
      .get("/api/v1/buddy/conversations/00000000-0000-4000-8000-000000000042")
      .set(gatewayUserHeaders({ requestId, userId, secret: options.serviceToken }));
    expect(response.status).toBe(200);
    expect(session).toHaveBeenCalledWith(userId, "00000000-0000-4000-8000-000000000042");
  });

  it("rejects malformed conversation IDs before calling the service", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { approved: true } }), { status: 200, headers: { "content-type": "application/json" } })));
    const session = vi.fn();
    const scopedService = new Proxy({}, { get: (_target, property) => property === "session" ? session : async () => [] }) as any;
    const response = await request(createWellnessApp(scopedService, options))
      .get("/api/v1/buddy/conversations/not-a-uuid")
      .set(gatewayUserHeaders({ requestId: "00000000-0000-4000-8000-000000000045", userId: "00000000-0000-4000-8000-000000000046", secret: options.serviceToken }));
    expect(response.status).toBe(400);
    expect(session).not.toHaveBeenCalled();
  });
});
