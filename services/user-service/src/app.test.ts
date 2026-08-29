import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { gatewayUserHeaders } from "@echo/service-core";
import { createUserApp } from "./app.js";
const controllerService = new Proxy({}, { get: () => async () => ({}) });
const dependencies = { onboarding: controllerService, settings: controllerService, verification: controllerService, database: { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }) } } as any;
describe("user service boundary", () => {
  it("starts independently", async () => expect((await request(createUserApp(dependencies, { internalToken: "x".repeat(32) })).get("/health")).status).toBe(200));
  it("rejects unsigned identities", async () => expect((await request(createUserApp(dependencies, { internalToken: "x".repeat(32) })).get("/api/v1/settings")).status).toBe(401));

  it("accepts and forwards avatarPath in profile settings", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000020";
    const userId = "00000000-0000-4000-8000-000000000021";
    const updateProfile = vi.fn().mockResolvedValue({ profile: { avatarPath: "avatars/user.png" } });
    const settings = new Proxy({}, { get: (_target, property) => property === "updateProfile" ? updateProfile : async () => ({}) });
    const avatarDependencies = { ...dependencies, settings } as any;
    const response = await request(createUserApp(avatarDependencies, { internalToken: token }))
      .patch("/api/v1/settings/profile")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .send({ displayName: "Mira", timezone: "Asia/Manila", themeVariant: "echo-soft", themeMode: "system", avatarPath: "avatars/user.png", isAdmin: true, userId: "attacker" });
    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(userId, expect.objectContaining({ avatarPath: "avatars/user.png" }));
    expect(updateProfile.mock.calls[0]?.[1]).not.toHaveProperty("isAdmin");
    expect(updateProfile.mock.calls[0]?.[1]).not.toHaveProperty("userId");
  });

  it("rejects malformed settings UUIDs before mutation", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000022";
    const userId = "00000000-0000-4000-8000-000000000023";
    const updateContact = vi.fn();
    const settings = new Proxy({}, { get: (_target, property) => property === "updateContact" ? updateContact : async () => ({}) });
    const response = await request(createUserApp({ ...dependencies, settings } as any, { internalToken: token }))
      .patch("/api/v1/settings/trusted-contacts/not-a-uuid")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(updateContact).not.toHaveBeenCalled();
  });

  it("requires active account-level consent for internal analysis access", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000001";
    const userId = "00000000-0000-4000-8000-000000000002";
    const query: any = {
      select: () => query,
      eq: () => query,
      is: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    const consentDependencies = {
      ...dependencies,
      verification: { assertAiAccess: vi.fn().mockResolvedValue(undefined) },
      database: { from: vi.fn(() => query) },
    } as any;
    const headers = gatewayUserHeaders({ requestId, userId, secret: token });

    const response = await request(createUserApp(consentDependencies, { internalToken: token }))
      .get("/api/v1/internal/analysis-access")
      .set("authorization", `Bearer ${token}`)
      .set(headers);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ANALYSIS_CONSENT_REQUIRED");
    expect(consentDependencies.database.from).toHaveBeenCalledWith("user_consents");
  });
});
