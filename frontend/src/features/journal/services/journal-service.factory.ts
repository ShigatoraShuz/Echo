import type { JournalService } from "./journal.service";
import { createJournalMockAdapter } from "./journal.mock-adapter";
import { createJournalHttpAdapter } from "./journal.http-adapter";

let instance: JournalService | null = null;

export function getJournalService(): JournalService {
  if (instance) return instance;

  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true" || !process.env.NEXT_PUBLIC_API_URL;

  instance = useMock
    ? createJournalMockAdapter()
    : createJournalHttpAdapter();

  return instance;
}

export function resetJournalService(): void {
  instance = null;
}
