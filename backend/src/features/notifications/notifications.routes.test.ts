import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import type { DailyDistressService } from "./daily-distress.service.js";
import type { NotificationService } from "./notifications.service.js";
import type { PushSubscriptionsService } from "./push-subscriptions.service.js";

function createHarness() {
  const verifier = {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
  };
  const notifications = {
    list: vi.fn().mockResolvedValue({ notifications: [] }),
    markRead: vi.fn().mockResolvedValue({
      notification: {
        id: "11111111-1111-4111-8111-111111111111",
        type: "system",
        title: "Saved",
        message: "Marked read",
        resourceType: null,
        resourceId: null,
        readAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    }),
    markAllRead: vi.fn().mockResolvedValue({ notifications: [] }),
  };
  const pushSubscriptions = {
    save: vi.fn().mockResolvedValue({ registered: true }),
    remove: vi.fn().mockResolvedValue({ registered: false }),
  };
  const dailyDistress = {
    get: vi.fn().mockResolvedValue({ rating: null }),
    save: vi.fn().mockResolvedValue({ rating: "high" }),
    suggest: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApp({
    v1: {
      notifications: {
        service: notifications as unknown as NotificationService,
        verifier,
        dailyDistress: dailyDistress as unknown as DailyDistressService,
        pushSubscriptions: pushSubscriptions as unknown as PushSubscriptionsService,
      },
    },
  });
  return { app, notifications, pushSubscriptions, dailyDistress };
}

describe("notification routes", () => {
  it("accepts additive scoped category/cursor filters and rejects unsafe cursors", async () => {
    const h = createHarness(), before = "2026-10-25T00:00:00.123456Z~11111111-1111-4111-8111-111111111111";
    expect((await request(h.app).get(`/api/v1/notifications?category=appointments&before=${encodeURIComponent(before)}`).set("Authorization", "Bearer valid-token")).status).toBe(200);
    expect(h.notifications.list).toHaveBeenCalledWith("user-1", { status: "all", limit: 20, category: "appointments", before });
    expect((await request(h.app).get("/api/v1/notifications?category=clinical").set("Authorization", "Bearer valid-token")).status).toBe(400);
    expect((await request(h.app).get("/api/v1/notifications?before=created_at.gt.now,forged").set("Authorization", "Bearer valid-token")).status).toBe(400);
  });
  it("requires authentication before listing notifications", async () => {
    const { app, notifications } = createHarness();

    const response = await request(app).get("/api/v1/notifications");

    expect(response.status).toBe(401);
    expect(notifications.list).not.toHaveBeenCalled();
  });

  it("lists unread notifications with a validated limit", async () => {
    const { app, notifications } = createHarness();

    const response = await request(app)
      .get("/api/v1/notifications?status=unread&limit=12")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(notifications.list).toHaveBeenCalledWith("user-1", { status: "unread", limit: 12 });
  });

  it("marks one owned notification as read", async () => {
    const { app, notifications } = createHarness();
    const id = "11111111-1111-4111-8111-111111111111";

    const response = await request(app)
      .patch(`/api/v1/notifications/${id}/read`)
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(notifications.markRead).toHaveBeenCalledWith("user-1", id);
  });

  it("marks all owned notifications as read", async () => {
    const { app, notifications } = createHarness();

    const response = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(notifications.markAllRead).toHaveBeenCalledWith("user-1");
  });

  it("registers and removes only the authenticated user's device", async () => {
    const { app, pushSubscriptions } = createHarness();
    const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test", expirationTime: null,
      keys: { p256dh: "public", auth: "secret" } };
    const registered = await request(app).post("/api/v1/notifications/push/subscriptions")
      .set("Authorization", "Bearer valid-token").send(subscription);
    expect(registered.status).toBe(200);
    expect(pushSubscriptions.save).toHaveBeenCalledWith("user-1", subscription);
    const removed = await request(app).post("/api/v1/notifications/push/unsubscribe")
      .set("Authorization", "Bearer valid-token").send({ endpoint: subscription.endpoint });
    expect(removed.status).toBe(200);
    expect(pushSubscriptions.remove).toHaveBeenCalledWith("user-1", subscription.endpoint);
  });

  it("rejects invalid and unauthenticated device registration", async () => {
    const { app, pushSubscriptions } = createHarness();
    expect((await request(app).post("/api/v1/notifications/push/subscriptions")
      .send({ endpoint: "https://fcm.googleapis.com/fcm/send/test" })).status).toBe(401);
    expect((await request(app).post("/api/v1/notifications/push/subscriptions")
      .set("Authorization", "Bearer valid-token").send({ endpoint: "http://localhost" })).status).toBe(400);
    expect(pushSubscriptions.save).not.toHaveBeenCalled();
  });
});


it("saves today's check-in for the authenticated account and evaluates the notification feed", async () => {
  const { app, dailyDistress } = createHarness();
  const path = "/api/v1/daily-distress-checkin";
  expect((await request(app).put(path).send({ rating: "high" })).status).toBe(401);
  expect((await request(app).put(path).set("Authorization", "Bearer valid-token").send({ rating: "high", day: "2026-11-10" })).status).toBe(400);
  expect((await request(app).put(path).set("Authorization", "Bearer valid-token").send({ rating: "high" })).body.data).toEqual({ rating: "high" });
  expect(dailyDistress.save).toHaveBeenCalledExactlyOnceWith("user-1", "high");
  await request(app).get("/api/v1/notifications").set("Authorization", "Bearer valid-token").expect(200);
  expect(dailyDistress.suggest).toHaveBeenCalledExactlyOnceWith("user-1");
});
