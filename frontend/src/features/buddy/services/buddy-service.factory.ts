import type { BuddyService } from "./buddy.service";
import { createBuddyMockAdapter } from "./buddy.mock-adapter";
import { createBuddyHttpAdapter } from "./buddy.http-adapter";
import { isMockAdapter } from "@/shared/services/service-adapter";

let instance: BuddyService | null = null;

export function getBuddyService(): BuddyService {
  if (instance) return instance;
  instance = isMockAdapter() ? createBuddyMockAdapter() : createBuddyHttpAdapter();
  return instance;
}

export function resetBuddyService(): void {
  instance = null;
}