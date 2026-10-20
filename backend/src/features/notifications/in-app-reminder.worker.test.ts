import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InAppReminderWorker } from "./in-app-reminder.worker.js";

describe("InAppReminderWorker", () => {
  it("runs the service-only reminder function without accessing user content", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    const database = { schema: vi.fn(() => ({ rpc })) } as unknown as SupabaseClient;
    const at = new Date("2026-10-17T00:00:00.000Z");

    await expect(new InAppReminderWorker(database).tick(at)).resolves.toBe(2);
    expect(database.schema).toHaveBeenCalledWith("notification_service");
    expect(rpc).toHaveBeenCalledWith("enqueue_due_in_app_reminders", { p_at: at.toISOString() });
  });

  it("fails closed when the database cannot enqueue reminders", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202", message: "offline" } });
    const database = { schema: vi.fn(() => ({ rpc })) } as unknown as SupabaseClient;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(new InAppReminderWorker(database).tick()).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    vi.restoreAllMocks();
  });
});
