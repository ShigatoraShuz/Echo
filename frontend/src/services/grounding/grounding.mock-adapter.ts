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
      if (previous) {
        if (input.completed !== false) Object.assign(previous, { state: "completed", progress: 100, completedAt: input.completedAt });
        return { success: true, data: previous };
      }
      const { sessionId, completed, ...values } = input;
      const session: GroundingSession = {
        id: sessionId ?? `gs-${Date.now().toString(36)}`,
        ...values,
        startedAt: input.completedAt,
        completedAt: completed === false ? null : input.completedAt,
        progress: completed === false ? 0 : 100,
        state: completed === false ? "running" : "completed",
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
