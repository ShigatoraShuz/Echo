import type { DashboardService } from "./dashboard.service";
import { env } from "@/config/environment";
import { normalizeError } from "@/shared/errors/normalize-error";
import { createApiClient } from "@/shared/services/api-client";
import { failureResult, successResult } from "@/shared/services/service-result";
import { supabaseAuthTokenProvider } from "@/shared/services/supabase-auth-token-provider";
import type { JournalEntryResponseDTO } from "@/features/journal/model/journal.dto";
import { mapEntryResponseToDomain } from "@/features/journal/model/journal.mapper";
import type { DashboardData } from "../model/dashboard.model";

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
    async getDashboardData() {
      try {
        const response = await client.get<{
          success: true;
          data: DashboardResponse;
        }>("/dashboard");
        return successResult({
          ...response.data,
          latestEntry: response.data.latestEntry
            ? mapEntryResponseToDomain(response.data.latestEntry)
            : null,
          journalEntries: response.data.journalEntries.map(mapEntryResponseToDomain),
        });
      } catch (error) {
        return failureResult(normalizeError(error));
      }
    },
  };
}
