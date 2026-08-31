import type { GroundingService } from "@/services/grounding/grounding.service";
import type { GroundingSession } from "@/features/grounding/model/grounding.model";

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
  };
}
