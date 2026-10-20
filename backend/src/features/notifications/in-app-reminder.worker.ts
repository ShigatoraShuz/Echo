import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import { logSupabaseError } from "../../infrastructure/supabase/supabase-diagnostics.js";

export class InAppReminderWorker {
  constructor(private readonly database: SupabaseClient) {}

  async tick(at = new Date()): Promise<number> {
    const { data, error } = await this.database.schema("notification_service")
      .rpc("enqueue_due_in_app_reminders", { p_at: at.toISOString() });
    if (error) {
      logSupabaseError({ module: "notifications.reminders", schema: "notification_service", table: "notifications", operation: "enqueue due reminders" }, error);
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "In-app reminders could not be prepared.");
    }
    return typeof data === "number" ? data : 0;
  }
}
