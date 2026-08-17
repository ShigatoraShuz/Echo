import type { BuddyService } from "@/services/buddy/buddy.service";
import { createBuddyMockAdapter } from "@/services/buddy/buddy.mock-adapter";
import { createBuddyHttpAdapter } from "@/services/buddy/buddy.http-adapter";
import { isMockAdapter } from "@/infrastructure/api/service-adapter";

let instance: BuddyService | null = null;

export function getBuddyService(): BuddyService {
  if (instance) return instance;
  instance = isMockAdapter() ? createBuddyMockAdapter() : createBuddyHttpAdapter();
  return instance;
}

export function resetBuddyService(): void {
  instance = null;
}