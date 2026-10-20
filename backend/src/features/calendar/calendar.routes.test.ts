import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import type { CalendarService } from "./calendar.service.js";

describe("calendar routes", () => {
  const service = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "item-1" }),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const app = createApp({
    v1: {
      calendar: {
        service: service as unknown as CalendarService,
        verifier: {
          getUser: async (token: string) => (token === "valid" ? { id: "owner-1", email: "user@example.com" } : null),
        },
      },
    },
  });

  it("requires authentication and validates the date range", async () => {
    expect((await request(app).get("/api/v1/calendar/items?from=2026-10-01&to=2026-10-31")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/v1/calendar/items?from=2026-10-31&to=2026-10-01")
          .set("Authorization", "Bearer valid")
      ).status,
    ).toBe(400);
    const response = await request(app)
      .get("/api/v1/calendar/items?from=2026-10-01&to=2026-10-31")
      .set("Authorization", "Bearer valid");
    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith("owner-1", "2026-10-01", "2026-10-31");
  });

  it("validates a private reminder before saving", async () => {
    const endpoint = request(app).post("/api/v1/calendar/items").set("Authorization", "Bearer valid");
    const invalid = await endpoint.send({
      scheduledOn: "2026-10-12",
      scheduledTime: null,
      kind: "reminder",
      content: " ",
    });
    expect(invalid.status).toBe(400);
    const valid = await request(app)
      .post("/api/v1/calendar/items")
      .set("Authorization", "Bearer valid")
      .send({ scheduledOn: "2026-10-12", scheduledTime: "09:30", kind: "reminder", content: "Breathe" });
    expect(valid.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith("owner-1", {
      scheduledOn: "2026-10-12",
      scheduledTime: "09:30",
      kind: "reminder",
      content: "Breathe",
    });
  });
});
