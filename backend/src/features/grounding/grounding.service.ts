import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

export class GroundingService {
  constructor(private readonly database: SupabaseClient) {}

  async completeGrounding(
    userId: string,
    input: { technique: string; durationSeconds: number; pace: string },
  ) {
    const { data, error } = await this.database
      .from("audit_events")
      .insert({
        user_id: userId,
        event_type: "grounding.session_completed",
        resource_type: "grounding_session",
        resource_id: null,
        request_id: randomUUID(),
        metadata: {
          technique: input.technique,
          duration_seconds: input.durationSeconds,
          pace: input.pace,
        },
      })
      .select("id, created_at")
      .single();
    if (error || !data) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The grounding session could not be recorded.");
    }
    const { count, error: countError } = await this.database
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "grounding.session_completed");
    if (countError) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Grounding history could not be loaded.");
    return { id: data.id, completedAt: data.created_at, completedSessions: count ?? 1 };
  }
}
