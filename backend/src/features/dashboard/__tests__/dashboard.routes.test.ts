import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { DashboardService } from "../dashboard.service.js";

function createHarness() {
  const service = {
    dashboard: vi.fn().mockResolvedValue({ journalEntries: [] }),
  };
  const verifier = {
    getUser: vi.fn(async (token: string) =>
      token === "valid-token" ? { id: "user-1", email: "user@example.com" } : null,
    ),
  };
  const app = createApp({
    v1: {
      dashboard: {
        service: service as unknown as DashboardService,
        verifier,
      },
    },
  });
  return { app, service };
}

describe("dashboard routes", () => {
  it("keeps personal dashboard data behind Supabase authentication", async () => {
    const { app, service } = createHarness();

    const unauthenticated = await request(app).get("/api/v1/dashboard");
    expect(unauthenticated.status).toBe(401);

    const authenticated = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer valid-token");
    expect(authenticated.status).toBe(200);
    expect(service.dashboard).toHaveBeenCalledWith("user-1");
  });
});

