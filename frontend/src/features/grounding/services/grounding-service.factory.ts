import type { GroundingService } from "./grounding.service";
import { createGroundingMockAdapter } from "./grounding.mock-adapter";
import { createGroundingHttpAdapter } from "./grounding.http-adapter";
import { isMockAdapter } from "@/shared/services/service-adapter";

let instance: GroundingService | null = null;

export function getGroundingService(): GroundingService {
  if (instance) return instance;
  instance = isMockAdapter() ? createGroundingMockAdapter() : createGroundingHttpAdapter();
  return instance;
}

export function resetGroundingService(): void {
  instance = null;
}