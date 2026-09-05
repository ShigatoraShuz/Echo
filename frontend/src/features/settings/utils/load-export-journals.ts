import type { JournalService } from "@/services/journal/journal.service";
import { DefaultJournalFilters, type JournalEntry } from "@/features/journal/model/journal.model";

export async function loadExportJournals(service: JournalService): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await service.listEntries(DefaultJournalFilters, page, 100);
    if (!result.success) throw new Error(result.error.message);
    entries.push(...result.data.entries);
    totalPages = result.data.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);
  return entries;
}
