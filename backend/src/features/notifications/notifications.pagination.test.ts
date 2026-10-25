import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { NotificationService } from "./notifications.service.js";
import { appointmentNotificationTypes } from "@echo/contracts";
const rows = Array.from({ length: 28 }, (_, i) => ({ id: `aa000000-0000-4000-8000-${String(i).padStart(12,"0")}`, user_id: "owner", notification_type: i < 25 ? "system" : appointmentNotificationTypes[i - 25], title: "Fictional update", message: "Fictional", read_at: null, created_at: "2026-10-25T00:00:00.123456Z" }));
function harness(olderAppointments = false) {
  const source = [...rows.map(row => ({ ...row, created_at: olderAppointments && row.notification_type !== "system" ? "2026-10-24T00:00:00.123456Z" : row.created_at })), { ...rows[0], user_id: "other-account", id: "foreign" }];
  const client = { schema: () => ({ from: () => {
    let selected = source, count = false, limit = 100;
    const ordering: string[] = [];
    const query = {
      select: (_: string, options?: { count?: string }) => { count = !!options?.count; return query; },
      eq: (key: string, value: unknown) => { selected = selected.filter(row => row[key as keyof typeof row] === value); return query; },
      is: (key: string, value: unknown) => query.eq(key,value),
      in: (_: string, values: string[]) => { selected = selected.filter(row => values.includes(row.notification_type)); return query; },
      not: (_: string, __: string, values: string) => { selected = selected.filter(row => !values.slice(1,-1).split(",").includes(row.notification_type)); return query; },
      or: (filter: string) => { const id = filter.match(/id.lt.([^)]*)/)![1], at = filter.match(/^created_at.lt.([^,]+)/)![1]; selected = selected.filter(row => row.created_at < at || row.created_at === at && row.id < id); return query; },
      order: (column: string) => { ordering.push(column); selected = [...selected].sort((a,b) => { for (const key of ordering) { const result = String(b[key as keyof typeof b]).localeCompare(String(a[key as keyof typeof a])); if (result) return result; } return 0; }); return query; },
      limit: (value: number) => { limit = value; return query; },
      then: (resolve: (value: unknown) => void) => resolve({ data: count ? null : selected.slice(0,limit), count: selected.length, error: null }),
    };
    return query;
  } }) } as unknown as SupabaseClient;
  return new NotificationService(client);
}
it("finds older appointment records before pagination while keeping the full owner unread count", async () => {
  const service = harness(true);
  expect((await service.list("owner", { status: "all", limit: 20 })).notifications.every(row => row.type === "system")).toBe(true);
  const page = await service.list("owner", { status: "all", limit: 20, category: "appointments" });
  expect(page.notifications.map(row => row.type).sort()).toEqual([...appointmentNotificationTypes].sort());
  expect(page.unreadCount).toBe(28);
  expect(page.nextCursor).toBeNull();
});
it("excludes all appointment variants from General and paginates timestamp ties without omissions", async () => {
  const service = harness();
  const first = await service.list("owner", { status: "all", limit: 20, category: "general" });
  expect(first.notifications).toHaveLength(20);
  expect(first.nextCursor).toMatch(/\.123456Z~/);
  const second = await service.list("owner", { status: "all", limit: 20, category: "general", before: first.nextCursor! });
  expect(second.notifications).toHaveLength(5);
  expect(new Set([...first.notifications,...second.notifications].map(row => row.id)).size).toBe(25);
  expect(second.nextCursor).toBeNull();
  expect(first.notifications.some(row => row.id === "foreign")).toBe(false);
});
