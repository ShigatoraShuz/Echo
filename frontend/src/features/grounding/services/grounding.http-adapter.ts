import type { GroundingService, GroundingServiceResult } from "./grounding.service";
import type { GroundingSession, PaceType } from "../model/grounding.model";
import { env } from "@/config/environment";
import { createApiClient } from "@/shared/services/api-client";
import { supabaseAuthTokenProvider } from "@/shared/services/supabase-auth-token-provider";

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface GroundingCompletionResponse {
  id: string;
  completedAt: string;
  completedSessions: number;
}

const BACKEND_PACES: Record<PaceType, "gentle" | "slower" | "steady"> = {
  slow: "gentle",
  medium: "slower",
  fast: "steady",
};

const NOT_SUPPORTED_MESSAGE = "Grounding history is not available in this build of the backend.";

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
          { technique: string; durationSeconds: number; pace: "gentle" | "slower" | "steady" }
        >("/grounding/sessions", {
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
            progress: 100,
            state: "completed",
          },
        };
      } catch (error) {
        return { success: false, error: { code: "UNKNOWN", message: "The grounding session could not be saved." } };
      }
    },

    async getHistory() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },
  };
}