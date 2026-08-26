import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { GroundingService } from "../grounding.service.js";

function createHarness() {
  const service = {
    completeGrounding: vi.fn().mockResolvedValue({
      id: "session-1",
      completedAt: "2026-07-25T00:00:00.000Z",
      completedSessions: 1,
    }),
  };
  const verifier = {
    getUser: vi.fn(async (token: string) =>
      token === "valid-token" ? { id: "user-1", email: "user@example.com" } : null,
    ),
  };
  const app = createApp({
    v1: {
      grounding: {
        service: service as unknown as GroundingService,
        verifier,
      },
    },
  });
  return { app, service };
}

describe("grounding routes", () => {
  it("records a validated grounding completion", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/grounding/sessions")
      .set("Authorization", "Bearer valid-token")
      .send({ technique: "box-breathing", durationSeconds: 120, pace: "gentle" });

    expect(response.status).toBe(201);
    expect(service.completeGrounding).toHaveBeenCalledWith("user-1", {
      technique: "box-breathing",
      durationSeconds: 120,
      pace: "gentle",
    });
  });
});

