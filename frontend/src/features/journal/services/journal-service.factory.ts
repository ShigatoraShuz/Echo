import type { JournalService } from "./journal.service";
import { createJournalMockAdapter } from "./journal.mock-adapter";
import { createJournalHttpAdapter } from "./journal.http-adapter";
import { isMockAdapter } from "@/shared/services/service-adapter";

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
