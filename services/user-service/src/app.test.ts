import request from "supertest";
import { describe, expect, it } from "vitest";
import { createUserApp } from "./app.js";
const controllerService = new Proxy({}, { get: () => async () => ({}) });
const dependencies = { onboarding: controllerService, settings: controllerService, verification: controllerService, database: { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }) } } as any;
describe("user service boundary", () => {
  it("starts independently", async () => expect((await request(createUserApp(dependencies, { internalToken: "x".repeat(32) })).get("/health")).status).toBe(200));
  it("rejects unsigned identities", async () => expect((await request(createUserApp(dependencies, { internalToken: "x".repeat(32) })).get("/api/v1/settings")).status).toBe(401));
});
