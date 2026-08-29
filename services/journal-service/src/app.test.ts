import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { gatewayUserHeaders } from "@echo/service-core";
import { createJournalApp } from "./app.js";

const service = { list: async () => [], get: async () => ({}), create: async () => ({}), update: async () => ({}), remove: async () => {}, saveDraft: async () => ({}), getDraft: async () => null, deleteDraft: async () => {}, analysisInput: async () => ({}) } as any;
describe("journal service boundary", () => {
  it("starts independently and exposes health", async () => expect((await request(createJournalApp(service, { internalToken: "x".repeat(32) })).get("/health")).status).toBe(200));
  it("rejects spoofed user identity", async () => expect((await request(createJournalApp(service, { internalToken: "x".repeat(32) })).get("/api/v1/journals").set("x-echo-user", "00000000-0000-4000-8000-000000000001")).status).toBe(401));
  it("validates and forwards supported journal listing parameters", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000010";
    const userId = "00000000-0000-4000-8000-000000000011";
    const list = vi.fn().mockResolvedValue({ entries: [], total: 0, page: 2, page_size: 10 });
    const app = createJournalApp({ ...service, list } as any, { internalToken: token });
    const response = await request(app)
      .get("/api/v1/journals?page=2&pageSize=10&query=calm&mood=happy&dateFrom=2026-01-01&dateTo=2026-12-31&sort=oldest")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }));
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(userId, { page: 2, pageSize: 10, query: "calm", mood: "happy", dateFrom: "2026-01-01", dateTo: "2026-12-31", sort: "oldest" });
    expect(response.body.data).toEqual({ entries: [], total: 0, page: 2, page_size: 10 });
  });
  it("accepts an untitled journal entry", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000012";
    const userId = "00000000-0000-4000-8000-000000000013";
    const create = vi.fn().mockResolvedValue({ id: "journal" });
    const response = await request(createJournalApp({ ...service, create } as any, { internalToken: token }))
      .post("/api/v1/journals")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .send({ title: "", body: "A private reflection", mood: "neutral", emotions: [], tags: [], privacy_status: "private", analysis_consent: false, userId: "attacker", riskScore: 100 });
    expect(response.status).toBe(201);
    expect(create.mock.calls[0]?.[1].title).toBe("");
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty("userId");
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty("riskScore");
  });
  it("rejects malformed journal UUIDs before the service call", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000014";
    const userId = "00000000-0000-4000-8000-000000000015";
    const get = vi.fn();
    const response = await request(createJournalApp({ ...service, get } as any, { internalToken: token }))
      .get("/api/v1/journals/not-a-uuid")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(get).not.toHaveBeenCalled();
  });
});
