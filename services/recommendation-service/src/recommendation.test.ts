import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { recommend } from "./recommendation.js";
import { RecommendationService } from "./recommendation.service.js";
import { createRecommendationApp } from "./app.js";

describe("recommendations", () => {
  it("prioritizes urgent support", () => expect(recommend({ severity: "minimal", urgentLanguageDetected: true }).category).toBe("urgent_support"));
  it("provides CBT reflection for moderate screening", () => expect(recommend({ severity: "moderate", urgentLanguageDetected: false }).category).toBe("cbt_reflection"));

  it("reads only verified active support resources", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "r1", support_resource_type: "crisis", organization_name: "Support", resource_name: "Hotline" }], error: null });
    const order = vi.fn(() => ({ limit }));
    const secondEq = vi.fn(() => ({ order }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const select = vi.fn(() => ({ eq: firstEq }));
    const database = { from: vi.fn(() => ({ select })) } as any;
    const result = await new RecommendationService(database).create({ severity: "severe", urgentLanguageDetected: false });
    expect(database.from).toHaveBeenCalledWith("support_resources");
    expect(result.supportResources).toEqual([expect.objectContaining({ id: "r1", name: "Hotline" })]);
  });

  it("keeps the public boundary authenticated", async () => {
    const service = { create: vi.fn() } as any;
    const response = await request(createRecommendationApp(service, "x".repeat(32)))
      .post("/api/v1/recommendations")
      .send({ severity: "mild", urgentLanguageDetected: false });
    expect(response.status).toBe(401);
    expect(service.create).not.toHaveBeenCalled();
  });
});
