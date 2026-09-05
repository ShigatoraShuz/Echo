import type { JournalService } from "@/services/journal/journal.service";
import type {
  JournalDraft,
  UpdateJournalInput,
  JournalServiceError,
} from "@/features/journal/model/journal.model";
import type {
  JournalEntryResponseDTO,
  JournalEntryListResponseDTO,
  JournalDraftResponseDTO,
  JournalAnalysisResponseDTO,
  CreateJournalRequestDTO,
} from "@/features/journal/model/journal.dto";
import {
  mapEntryResponseToDomain,
  mapDraftResponseToDomain,
  mapAnalysisResponseToDomain,
  mapCreateInputToRequest,
} from "@/features/journal/model/journal.mapper";
import { env } from "@/config/environment";
import { normalizeError } from "@/shared/errors/normalize-error";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

function toServiceError(error: unknown): JournalServiceError {
  const normalized = normalizeError(error);
  switch (normalized.code) {
    case "NOT_FOUND":
      return { code: "NOT_FOUND", message: normalized.userMessage };
    case "VALIDATION_ERROR":
      return {
        code: "VALIDATION",
        message: normalized.userMessage,
        details: normalized.fieldErrors?.reduce<Record<string, string[]>>((acc, field) => {
          acc[field.field] = [...(acc[field.field] ?? []), field.message];
          return acc;
        }, {}),
      };
    case "AUTHENTICATION_ERROR":
      return { code: "UNAUTHORIZED", message: normalized.userMessage };
    case "AUTHORIZATION_ERROR":
      return { code: "FORBIDDEN", message: normalized.userMessage };
    case "CONFLICT":
      return { code: "CONFLICT", message: normalized.userMessage };
    case "NETWORK_ERROR":
    case "TIMEOUT":
    case "RATE_LIMITED":
      return { code: "NETWORK", message: normalized.userMessage };
    default:
      return { code: "UNKNOWN", message: normalized.userMessage };
  }
}

export function createJournalHttpAdapter(): JournalService {
  const client = createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  });

  return {
    async listEntries(filters, page, pageSize, signal) {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (filters.query) params.set("query", filters.query);
        if (filters.mood) params.set("mood", filters.mood);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        params.set("sort", filters.sort);
        const response = await client.get<{ success: true; data: JournalEntryListResponseDTO }>(
          `/journals?${params.toString()}`,
          { signal },
        );
        const entries = response.data.entries.map(mapEntryResponseToDomain);
        return {
          success: true,
          data: {
            entries,
            pagination: {
              page: response.data.page,
              pageSize: response.data.page_size,
              totalItems: response.data.total,
              totalPages: Math.max(1, Math.ceil(response.data.total / response.data.page_size)),
            },
          },
        };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async getEntry(id, signal) {
      try {
        const response = await client.get<{ success: true; data: JournalEntryResponseDTO }>(
          `/journals/${id}`,
          { signal },
        );
        return { success: true, data: mapEntryResponseToDomain(response.data) };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async createEntry(input) {
      try {
        const response = await client.post<{ success: true; data: JournalEntryResponseDTO }, CreateJournalRequestDTO>(
          "/journals",
          mapCreateInputToRequest(input),
        );
        return { success: true, data: mapEntryResponseToDomain(response.data) };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async updateEntry(id, input) {
      try {
        const response = await client.patch<{ success: true; data: JournalEntryResponseDTO }, UpdateJournalInput>(
          `/journals/${id}`,
          input,
        );
        return { success: true, data: mapEntryResponseToDomain(response.data) };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async deleteEntry(id) {
      try {
        await client.delete<undefined>(`/journals/${id}`);
        return { success: true, data: undefined as unknown as void };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async saveDraft(draft) {
      try {
        const response = await client.put<{ success: true; data: JournalDraftResponseDTO }, JournalDraft>(
          "/journals/draft",
          draft,
        );
        return { success: true, data: mapDraftResponseToDomain(response.data) };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async getDraft(_id: string, signal?: AbortSignal) {
      try {
        const response = await client.get<{ success: true; data: JournalDraftResponseDTO | null }>(
          "/journals/draft",
          { signal },
        );
        return { success: true, data: response.data ? mapDraftResponseToDomain(response.data) : null };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async deleteDraft() {
      try {
        await client.delete<undefined>("/journals/draft");
        return { success: true, data: undefined as unknown as void };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async requestAnalysis(entryId) {
      try {
        const response = await client.post<{ success: true; data: JournalAnalysisResponseDTO }>(
          `/journals/${entryId}/analyze`,
          undefined,
          { timeout: 70_000 },
        );
        return { success: true, data: mapAnalysisResponseToDomain(response.data) };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
    async getAnalysis(entryId) {
      try {
        const response = await client.get<{ success: true; data: JournalAnalysisResponseDTO | null }>(
          `/journals/${entryId}/analyses`,
        );
        return { success: true, data: response.data ? mapAnalysisResponseToDomain(response.data) : null };
      } catch (error) {
        return { success: false, error: toServiceError(error) };
      }
    },
  };
}
