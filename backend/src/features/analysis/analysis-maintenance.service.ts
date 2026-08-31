import type { SupabaseClient } from "@supabase/supabase-js";

/** Separate from inference: failure never reopens or invalidates an immutable result. */
export class AnalysisMaintenanceService {
  private running = false;
  constructor(private readonly database: SupabaseClient) {}
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const aggregate = await this.database.schema("ai_analysis").rpc("run_aggregation_tasks", { p_limit: 20 });
      if (aggregate.error) throw new Error("Analysis aggregation maintenance unavailable.");
      const retention = await this.database.schema("ai_analysis").rpc("run_retention", { p_dry_run: false });
      if (retention.error) throw new Error("Analysis retention maintenance unavailable.");
    } finally {
      this.running = false;
    }
  }
}
