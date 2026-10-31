import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

/** Trusted maintenance only. No browser/HTTP endpoint and no external transport. */
export class ProfessionalEventService {
  constructor(private readonly database: SupabaseClient) {}
  async runBatch() {
    const queued = await this.database.schema("professional_service").rpc("enqueue_follow_up_reminders", { p_limit: 100 });
    if (queued.error) throw new ExternalServiceError("PROFESSIONAL_EVENTS_UNAVAILABLE", "Professional reminder processing is unavailable.");
    const processed = await this.database.schema("professional_service").rpc("process_events", { p_limit: 100 });
    if (processed.error) throw new ExternalServiceError("PROFESSIONAL_EVENTS_UNAVAILABLE", "Professional event processing is unavailable.");
    const health = await this.database.schema("professional_service").rpc("event_health");
    if (health.error) throw new ExternalServiceError("PROFESSIONAL_EVENTS_UNAVAILABLE", "Professional event health is unavailable.");
    // Fixed counters only; never log RPC diagnostics, event IDs or case content.
    return { enqueued: Number(queued.data), delivered: Number(processed.data.delivered), suppressed: Number(processed.data.suppressed), failures: Number(processed.data.failures),
      pending: Number(health.data.pending), ready: Number(health.data.ready), failed: Number(health.data.failed), oldestPendingAt: health.data.oldestPendingAt as string | null };
  }
}
