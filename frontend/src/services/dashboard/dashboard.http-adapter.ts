import type { DashboardService } from "@/services/dashboard/dashboard.service";
import { env } from "@/config/environment";
import { normalizeError } from "@/shared/errors/normalize-error";
import { createApiClient } from "@/infrastructure/api/api-client";
import { failureResult, successResult } from "@/infrastructure/api/service-result";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type { DashboardData } from "@/features/dashboard/model/dashboard.model";

export function createDashboardHttpAdapter(): DashboardService {
  const client = createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  });

  type DashboardSummary = { id: string; title: string; mood: DashboardData["journalEntries"][number]["mood"]; emotions: string[]; tags: string[]; created_at: string };
  type DashboardResponse = Omit<DashboardData, "latestEntry" | "journalEntries"> & {
    latestEntry: DashboardSummary | null;
    journalEntries: DashboardSummary[];
  };
  const mapSummary = (entry: DashboardSummary) => ({
    id: entry.id, title: entry.title, mood: entry.mood,
    emotions: entry.emotions, tags: entry.tags, createdAt: entry.created_at,
  });

  return {
    async getDashboardData(timeRange?: string) {
      try {
        const queryParam = timeRange ? `?range=${encodeURIComponent(timeRange)}` : "";
        const response = await client.get<{
            success: true;
            data: DashboardResponse;
          }>(`/dashboard${queryParam}`);
        return successResult({
          ...response.data,
          latestEntry: response.data.latestEntry ? mapSummary(response.data.latestEntry) : null,
          journalEntries: response.data.journalEntries.map(mapSummary),
        });
      } catch (error) {
        return failureResult(normalizeError(error));
      }
    },
  };
}
