import request from "supertest";
import { describe, expect, it } from "vitest";
import { createJournalApp } from "./app.js";

const service = { list: async () => [], get: async () => ({}), create: async () => ({}), update: async () => ({}), remove: async () => {}, saveDraft: async () => ({}), getDraft: async () => null, deleteDraft: async () => {}, analysisInput: async () => ({}) } as any;
describe("journal service boundary", () => {
  it("starts independently and exposes health", async () => expect((await request(createJournalApp(service, { internalToken: "x".repeat(32) })).get("/health")).status).toBe(200));
  it("rejects spoofed user identity", async () => expect((await request(createJournalApp(service, { internalToken: "x".repeat(32) })).get("/api/v1/journals").set("x-echo-user", "00000000-0000-4000-8000-000000000001")).status).toBe(401));
});
