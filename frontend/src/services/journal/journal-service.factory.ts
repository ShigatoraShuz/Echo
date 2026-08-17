import type { JournalService } from "@/services/journal/journal.service";
import { createJournalMockAdapter } from "@/services/journal/journal.mock-adapter";
import { createJournalHttpAdapter } from "@/services/journal/journal.http-adapter";
import { isMockAdapter } from "@/infrastructure/api/service-adapter";

let instance: JournalService | null = null;

export function getJournalService(): JournalService {
  if (instance) return instance;

  instance = isMockAdapter()
    ? createJournalMockAdapter()
    : createJournalHttpAdapter();

  return instance;
}

export function resetJournalService(): void {
  instance = null;
}
