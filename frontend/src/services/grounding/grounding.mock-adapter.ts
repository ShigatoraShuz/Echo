import type { GroundingService, GroundingServiceResult } from "@/services/grounding/grounding.service";
import type { GroundingSession, ExerciseType, PaceType } from "@/features/grounding/model/grounding.model";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sessions: GroundingSession[] = [];

export function createGroundingMockAdapter(): GroundingService {
  return {
    async saveSession(input) {
      await delay(150);
      const previous = input.sessionId ? sessions.find((item) => item.id === input.sessionId) : undefined;
      if (previous) return { success: true, data: previous };
      const { sessionId, ...values } = input;
      const session: GroundingSession = {
        id: sessionId ?? `gs-${Date.now().toString(36)}`,
        ...values,
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
