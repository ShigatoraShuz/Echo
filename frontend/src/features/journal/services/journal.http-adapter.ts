import type { JournalService, JournalServiceResult } from "./journal.service";
import type { JournalEntry, CreateJournalInput, UpdateJournalInput, JournalSearchFilters, JournalPagination } from "../model/journal.model";

export function createJournalHttpAdapter(): JournalService {
  return {
    async listEntries(filters, page, pageSize, signal) {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (filters.query) params.set("query", filters.query);
        if (filters.mood) params.set("mood", filters.mood);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        params.set("sort", filters.sort);
        const res = await fetch(`/api/v1/journals?${params.toString()}`, { signal });
        if (!res.ok) return { success: false, error: { code: "NETWORK", message: "Failed to fetch entries" } };
        const data = await res.json();
        return { success: true, data: { entries: data.data.entries, pagination: data.data.pagination } };
      } catch (err) {
        return { success: false, error: { code: "NETWORK", message: err instanceof Error ? err.message : "Network error" } };
      }
    },
    async getEntry(id, signal) {
      try {
        const res = await fetch(`/api/v1/journals/${id}`, { signal });
        if (!res.ok) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };
        return { success: true, data: await res.json() };
      } catch (err) {
        return { success: false, error: { code: "NETWORK", message: err instanceof Error ? err.message : "Network error" } };
      }
    },
    async createEntry(input) {
      try {
        const res = await fetch("/api/v1/journals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        if (!res.ok) return { success: false, error: { code: "VALIDATION", message: "Failed to create entry" } };
        return { success: true, data: await res.json() };
      } catch (err) {
        return { success: false, error: { code: "NETWORK", message: err instanceof Error ? err.message : "Network error" } };
      }
    },
    async updateEntry(id, input) {
      try {
        const res = await fetch(`/api/v1/journals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        if (!res.ok) return { success: false, error: { code: "VALIDATION", message: "Failed to update entry" } };
        return { success: true, data: await res.json() };
      } catch (err) {
        return { success: false, error: { code: "NETWORK", message: err instanceof Error ? err.message : "Network error" } };
      }
    },
    async deleteEntry(id) {
      try {
        const res = await fetch(`/api/v1/journals/${id}`, { method: "DELETE" });
        if (!res.ok) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };
        return { success: true, data: undefined as unknown as void };
      } catch (err) {
        return { success: false, error: { code: "NETWORK", message: err instanceof Error ? err.message : "Network error" } };
      }
    },
    async saveDraft(draft) { return { success: true, data: draft }; },
    async getDraft(id) { return { success: true, data: null }; },
    async deleteDraft(id) { return { success: true, data: undefined as unknown as void }; },
    async requestAnalysis(entryId) { return { success: false, error: { code: "UNKNOWN", message: "Analysis not available" } }; },
    async getAnalysis(entryId) { return { success: false, error: { code: "UNKNOWN", message: "Analysis not available" } }; },
    async exportEntry(id) { return { success: false, error: { code: "UNKNOWN", message: "Export not available" } }; },
  };
}
