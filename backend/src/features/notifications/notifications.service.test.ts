import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { NotificationService } from "./notifications.service.js";

describe("notification list", () => {
  it("returns the owner-scoped unread total even when it exceeds the visible page", async () => {
    const filters: Array<Array<[string, unknown]>> = [];
    const selections: Array<{ columns: string; options: unknown }> = [];
    const database = {
      schema: (schema: string) => {
        expect(schema).toBe("notification_service");
        return {
          from: (table: string) => {
            expect(table).toBe("notifications");
            const index = filters.push([]) - 1;
            const query = {
              select(columns: string, options?: unknown) {
                selections[index] = { columns, options };
                return query;
              },
              eq(column: string, value: unknown) {
                filters[index].push([column, value]);
                return query;
              },
              is(column: string, value: unknown) {
                filters[index].push([column, value]);
                return query;
              },
              order() { return query; },
              limit() { return query; },
              then(resolve: (value: unknown) => void) {
                resolve(index === 0
                  ? { data: [{ id: "notice-1", notification_type: "system", title: "Latest", message: "Update", resource_type: null, resource_id: null, read_at: null, created_at: "2026-10-17T00:00:00Z" }], error: null }
                  : { data: null, count: 24, error: null });
              },
            };
            return query;
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await new NotificationService(database).list("owner-1", { status: "all", limit: 20 });

    expect(result.notifications).toHaveLength(1);
    expect(result.unreadCount).toBe(24);
    expect(filters).toEqual([
      [["user_id", "owner-1"]],
      [["user_id", "owner-1"], ["read_at", null]],
    ]);
    expect(selections[1]).toEqual({ columns: "id", options: { count: "exact", head: true } });
  });
});
