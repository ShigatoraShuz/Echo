import type { JournalService, JournalServiceResult } from "./journal.service";

/**
 * HTTP adapter for JournalService.
 * Not yet connected — requires a configured API client and backend endpoints.
 * Returns unimplemented errors for all methods to ensure type safety.
 */
export function createJournalHttpAdapter(): JournalService {
  function notImplemented(): JournalServiceResult<never> {
    return { success: false, error: { code: "NETWORK", message: "HTTP adapter not yet connected" } };
  }

  return {
    async listEntries() {
      return notImplemented();
    },

    async getEntry() {
      return notImplemented();
    },

    async createEntry() {
      return notImplemented();
    },

    async updateEntry() {
      return notImplemented();
    },

    async deleteEntry() {
      return notImplemented();
    },

    async saveDraft() {
      return notImplemented();
    },

    async getDraft() {
      return notImplemented();
    },

    async deleteDraft() {
      return notImplemented();
    },

    async requestAnalysis() {
      return notImplemented();
    },

    async getAnalysis() {
      return notImplemented();
    },

    async exportEntry() {
      return notImplemented();
    },
  };
}
