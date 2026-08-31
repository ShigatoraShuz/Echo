import type { DashboardService } from "@/services/dashboard/dashboard.service";
import { env } from "@/config/environment";
import { normalizeError } from "@/shared/errors/normalize-error";
import { createApiClient } from "@/infrastructure/api/api-client";
import { failureResult, successResult } from "@/infrastructure/api/service-result";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type { JournalEntryResponseDTO } from "@/features/journal/model/journal.dto";
import { mapEntryResponseToDomain } from "@/features/journal/model/journal.mapper";
import type { DashboardData } from "@/features/dashboard/model/dashboard.model";
import type { DashboardInsights } from "@echo/contracts";

export function createDashboardHttpAdapter(): DashboardService {
  const client = createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  });

  type DashboardResponse = Omit<DashboardData, "latestEntry" | "journalEntries"> & {
    latestEntry: JournalEntryResponseDTO | null;
    journalEntries: JournalEntryResponseDTO[];
  };

  return {
    async getDashboardData(timeRange?: string) {
      try {
        const queryParam = timeRange ? `?range=${encodeURIComponent(timeRange)}` : "";
        const [response, insightsResponse] = await Promise.all([
          client.get<{
            success: true;
            data: DashboardResponse;
          }>(`/dashboard${queryParam}`),
          client.get<{ success: true; data: DashboardInsights }>("/dashboard/insights"),
        ]);
        return successResult({
          ...response.data,
          latestEntry: response.data.latestEntry ? mapEntryResponseToDomain(response.data.latestEntry) : null,
          journalEntries: response.data.journalEntries.map(mapEntryResponseToDomain),
          analysisInsights: insightsResponse.data,
        });
      } catch (error) {
        return failureResult(normalizeError(error));
      }
    },
  };
}
