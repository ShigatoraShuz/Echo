import type { GroundingService } from "./grounding.service";
import { createGroundingMockAdapter } from "./grounding.mock-adapter";

let instance: GroundingService | null = null;

export function getGroundingService(): GroundingService {
  if (instance) return instance;
  instance = createGroundingMockAdapter();
  return instance;
}

export function resetGroundingService(): void {
  instance = null;
}
