import type { GroundingService, GroundingServiceResult } from "./grounding.service";
import type { GroundingSession, ExerciseType, PaceType } from "../model/grounding.model";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sessions: GroundingSession[] = [];

export function createGroundingMockAdapter(): GroundingService {
  return {
    async saveSession(input) {
      await delay(150);
      const session: GroundingSession = {
        id: `gs-${Date.now().toString(36)}`,
        ...input,
        progress: 100,
        state: "completed",
      };
      sessions.push(session);
      return { success: true, data: session };
    },
    async getHistory(limit = 10) {
      await delay(100);
      return { success: true, data: sessions.slice(-limit).reverse() };
    },
  };
}
