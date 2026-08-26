import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { SupportResourcesService } from "../support-resources.service.js";

function createHarness() {
  const service = {
    supportResources: vi.fn().mockResolvedValue([{ id: "resource-1", name: "Verified support" }]),
  };
  const app = createApp({
    v1: {
      supportResources: {
        service: service as unknown as SupportResourcesService,
      },
    },
  });
  return { app, service };
}

describe("support-resources routes", () => {
  it("serves the public verified-support endpoint without authentication", async () => {
    const { app, service } = createHarness();
    const response = await request(app).get("/api/v1/support-resources?q=crisis&type=all");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: "resource-1", name: "Verified support" }]);
    expect(service.supportResources).toHaveBeenCalledWith("crisis", "all");
  });
});

