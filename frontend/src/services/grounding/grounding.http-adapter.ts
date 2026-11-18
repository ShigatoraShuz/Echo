import type { GroundingService } from "@/services/grounding/grounding.service";
import type { ExerciseType, PaceType } from "@/features/grounding/model/grounding.model";
import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface GroundingCompletionResponse {
  id: string;
  completedAt: string | null;
  startedAt?: string;
  completed?: boolean;
  completedSessions: number;
}

const BACKEND_PACES: Record<PaceType, "gentle" | "slower" | "steady"> = {
  slow: "gentle",
  medium: "slower",
  fast: "steady",
};

interface GroundingHistoryItem {
  id: string;
  type: ExerciseType;
  duration: number;
  pace: "gentle" | "slower" | "steady";
  completedAt: string | null;
  startedAt?: string;
  completed?: boolean;
}

const FRONTEND_PACES: Record<GroundingHistoryItem["pace"], PaceType> = {
  gentle: "slow",
  slower: "medium",
  steady: "fast",
};

export function createGroundingHttpAdapter(): GroundingService {
  const client = createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  });

  return {
    async saveSession(session) {
      try {
        const response = await client.post<
          ApiEnvelope<GroundingCompletionResponse>,
          { completed?: boolean; sessionId?: string; technique: string; durationSeconds: number; pace: "gentle" | "slower" | "steady" }
        >("/grounding/sessions", {
          ...(session.sessionId ? { sessionId: session.sessionId } : {}),
          ...(session.completed === false ? { completed: false } : {}),
          technique: session.type,
          durationSeconds: session.duration,
          pace: BACKEND_PACES[session.pace],
        });
        return {
          success: true,
          data: {
            id: response.data.id,
            type: session.type,
            duration: session.duration,
            pace: session.pace,
            completedAt: response.data.completedAt,
            startedAt: response.data.startedAt,
            progress: response.data.completedAt ? 100 : 0,
            state: response.data.completedAt ? "completed" : "running",
          },
        };
      } catch {
        return { success: false, error: { code: "UNKNOWN", message: "The grounding session could not be saved." } };
      }
    },

    async getHistory(limit = 250) {
      try {
        const response = await client.get<ApiEnvelope<GroundingHistoryItem[]>>("/grounding/sessions");
        return {
          success: true,
          data: response.data.slice(0, limit).map((item) => ({
            ...item,
            pace: FRONTEND_PACES[item.pace] ?? "slow",
            completedAt: item.completedAt,
            progress: item.completed === false ? 0 : 100,
            state: item.completed === false ? "running" as const : "completed" as const,
          })),
        };
      } catch {
        return { success: false, error: { code: "UNKNOWN", message: "Grounding history could not be loaded." } };
      }
    },
  };
}
