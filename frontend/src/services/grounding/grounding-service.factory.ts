import type { GroundingService } from "@/services/grounding/grounding.service";
import { createGroundingMockAdapter } from "@/services/grounding/grounding.mock-adapter";
import { createGroundingHttpAdapter } from "@/services/grounding/grounding.http-adapter";
import { isMockAdapter } from "@/infrastructure/api/service-adapter";

let instance: GroundingService | null = null;

export function getGroundingService(): GroundingService {
  if (instance) return instance;
  instance = isMockAdapter() ? createGroundingMockAdapter() : createGroundingHttpAdapter();
  return instance;
}

export function resetGroundingService(): void {
  instance = null;
}