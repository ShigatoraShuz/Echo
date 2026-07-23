import type { BuddyService } from "./buddy.service";
import { createBuddyMockAdapter } from "./buddy.mock-adapter";
import { isMockAdapter } from "@/shared/services/service-adapter";

let instance: BuddyService | null = null;

export function getBuddyService(): BuddyService {
  if (instance) return instance;
  instance = isMockAdapter() ? createBuddyMockAdapter() : createBuddyMockAdapter();
  return instance;
}

export function resetBuddyService(): void {
  instance = null;
}
