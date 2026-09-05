import { describe, expect, it } from "vitest";
import { NotificationsService } from "./notifications.service.js";

function fixture(data: unknown = [{ id: "n", user_id: "owner", notification_type: "info" }], failed = false) {
  const operations: unknown[][] = [];
  const result = { data, error: failed ? { message: "unavailable" } : null };
  const query: any = {};
  for (const method of ["select", "eq", "is", "order", "limit", "update"]) {
    query[method] = (...args: unknown[]) => { operations.push([method, ...args]); return query; };
  }
  query.maybeSingle = async () => ({ ...result, data: Array.isArray(data) ? data[0] : data });
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return { service: new NotificationsService({ from: () => query } as any), operations };
}

describe("Notification ownership", () => {
  it("filters unread notifications by owner and requested limit", async () => {
    const { service, operations } = fixture();
    await service.list("owner", "unread", 7);
    expect(operations).toContainEqual(["eq", "user_id", "owner"]);
    expect(operations).toContainEqual(["is", "read_at", null]);
    expect(operations).toContainEqual(["limit", 7]);
  });
  it("scopes single-notification updates by both identifier and owner", async () => {
    const { service, operations } = fixture();
    await service.markRead("owner", "n");
    expect(operations).toContainEqual(["eq", "id", "n"]);
    expect(operations).toContainEqual(["eq", "user_id", "owner"]);
  });
  it("returns not found for an unavailable owner-scoped record", async () => {
    await expect(fixture(null).service.markRead("owner", "someone-elses-notification")).rejects.toMatchObject({ statusCode: 404 });
  });
  it("propagates database failure instead of returning an empty list", async () => {
    await expect(fixture([], true).service.list("owner", "all", 20)).rejects.toMatchObject({ statusCode: 503 });
  });
});
