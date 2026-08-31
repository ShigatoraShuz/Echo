import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { gatewayUserHeaders } from "@echo/service-core";
import { createUserApp } from "./app.js";
const controllerService = new Proxy({}, { get: () => async () => ({}) });
const dependencies = { onboarding: controllerService, settings: controllerService, verification: controllerService, database: { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }) } } as any;
describe("user service boundary", () => {
  it("starts independently", async () => expect((await request(createUserApp(dependencies, { internalToken: "x".repeat(32) })).get("/health")).status).toBe(200));
  it("rejects unsigned identities", async () => expect((await request(createUserApp(dependencies, { internalToken: "x".repeat(32) })).get("/api/v1/settings")).status).toBe(401));

  it("accepts partial profile PATCH fields and blocks settings mass assignment", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000020";
    const userId = "00000000-0000-4000-8000-000000000021";
    const updateProfile = vi.fn().mockResolvedValue({ displayName: "Mira" });
    const settings = new Proxy({}, { get: (_target, property) => property === "updateProfile" ? updateProfile : async () => ({}) });
    const avatarDependencies = { ...dependencies, settings } as any;
    const response = await request(createUserApp(avatarDependencies, { internalToken: token }))
      .patch("/api/v1/settings/profile")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .send({ displayName: "Mira", avatarPath: "data:image/png;base64,forbidden", isAdmin: true, userId: "attacker" });
    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(userId, { displayName: "Mira" });
    expect(updateProfile.mock.calls[0]?.[1]).not.toHaveProperty("isAdmin");
    expect(updateProfile.mock.calls[0]?.[1]).not.toHaveProperty("userId");
    expect(updateProfile.mock.calls[0]?.[1]).not.toHaveProperty("avatarPath");
  });

  it("accepts a one-field privacy PATCH without defaulting omitted fields", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000030";
    const userId = "00000000-0000-4000-8000-000000000031";
    const updatePrivacy = vi.fn().mockResolvedValue({ crisisSupportVisible: false });
    const settings = new Proxy({}, { get: (_target, property) => property === "updatePrivacy" ? updatePrivacy : async () => ({}) });
    const response = await request(createUserApp({ ...dependencies, settings } as any, { internalToken: token }))
      .patch("/api/v1/settings/privacy")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .send({ crisisSupportVisible: false, userId: "attacker" });
    expect(response.status).toBe(200);
    expect(updatePrivacy).toHaveBeenCalledWith(userId, { crisisSupportVisible: false });
  });

  it("accepts avatar bytes only through the dedicated upload route", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000032";
    const userId = "00000000-0000-4000-8000-000000000033";
    const uploadAvatar = vi.fn().mockResolvedValue({ avatarPath: "https://signed.example/avatar" });
    const settings = new Proxy({}, { get: (_target, property) => property === "uploadAvatar" ? uploadAvatar : async () => ({}) });
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const response = await request(createUserApp({ ...dependencies, settings } as any, { internalToken: token }))
      .put("/api/v1/settings/avatar")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .set("content-type", "image/png")
      .send(bytes);
    expect(response.status).toBe(200);
    expect(uploadAvatar).toHaveBeenCalledWith(userId, "image/png", expect.any(Buffer));
  });

  it("filters privileged verification fields before the service call", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000024";
    const userId = "00000000-0000-4000-8000-000000000025";
    const saveApplication = vi.fn().mockResolvedValue({ status: "draft" });
    const verification = new Proxy({}, { get: (_target, property) => property === "saveApplication" ? saveApplication : async () => ({}) });
    const response = await request(createUserApp({ ...dependencies, verification } as any, { internalToken: token }))
      .put("/api/v1/verification/application")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .send({
        legalName: "Mira Santos",
        dateOfBirth: "1995-04-12",
        phoneNumber: "+639171234567",
        address: { line1: "12 Hope Street", line2: null, city: "Manila", province: "Metro Manila", postalCode: "1000", countryCode: "ph", isVerified: true },
        governmentIdType: "passport",
        governmentIdNumber: "P1234567",
        guardian: null,
        privacyNoticeAccepted: true,
        identityVerificationConsent: true,
        guardianConsent: false,
        verificationStatus: "approved",
        reviewedBy: userId,
        userId: "attacker",
      });
    expect(response.status).toBe(200);
    expect(saveApplication).toHaveBeenCalledWith(userId, expect.objectContaining({
      legalName: "Mira Santos",
      guardian: null,
      guardianConsent: false,
      address: expect.objectContaining({ countryCode: "PH" }),
    }));
    const input = saveApplication.mock.calls[0]?.[1];
    expect(input).not.toHaveProperty("verificationStatus");
    expect(input).not.toHaveProperty("reviewedBy");
    expect(input).not.toHaveProperty("userId");
    expect(input.address).not.toHaveProperty("isVerified");
  });

  it("rejects malformed verification UUIDs before admin mutation", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000026";
    const userId = "00000000-0000-4000-8000-000000000027";
    const decide = vi.fn();
    const verification = new Proxy({}, { get: (_target, property) => property === "decide" ? decide : async () => ({}) });
    const response = await request(createUserApp({ ...dependencies, verification } as any, { internalToken: token }))
      .post("/api/v1/admin/verifications/not-a-uuid/decision")
      .set(gatewayUserHeaders({ requestId, userId, secret: token }))
      .send({ decision: "approved" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(decide).not.toHaveBeenCalled();
  });

  it("requires the target service token on internal routes", async () => {
    const token = "x".repeat(32);
    const requestId = "00000000-0000-4000-8000-000000000028";
    const userId = "00000000-0000-4000-8000-000000000029";
    const response = await request(createUserApp(dependencies, { internalToken: token }))
      .get("/api/v1/internal/analysis-access")
      .set("authorization", `Bearer ${"y".repeat(32)}`)
      .set(gatewayUserHeaders({ requestId, userId, secret: token }));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_INTERNAL_TOKEN");
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
