import { describe, expect, it, vi } from "vitest";
import type { JournalService } from "@/services/journal/journal.service";
import { loadExportJournals } from "./load-export-journals";

describe("Journal export pagination", () => {
  it("loads every page within the API's 100-entry limit", async () => {
    const listEntries = vi.fn().mockResolvedValueOnce({ success: true, data: { entries: [{ id: "first" }], pagination: { totalPages: 2 } } })
      .mockResolvedValueOnce({ success: true, data: { entries: [{ id: "last" }], pagination: { totalPages: 2 } } });
    const entries = await loadExportJournals({ listEntries } as unknown as JournalService);
    expect(entries.map((entry) => entry.id)).toEqual(["first", "last"]);
    expect(listEntries.mock.calls.map((call) => call.slice(1))).toEqual([[1, 100], [2, 100]]);
  });
  it("does not turn a failed download into a successful empty export", async () => {
    const listEntries = vi.fn().mockResolvedValue({ success: false, error: { message: "unavailable" } });
    await expect(loadExportJournals({ listEntries } as unknown as JournalService)).rejects.toThrow("unavailable");
  });
});
