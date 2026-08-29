import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

export type QuickMood = "awful" | "bad" | "okay" | "good" | "great";
export type Phq8Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
export interface Phq8Result {
  score: number;
  severity: Phq8Severity;
  disclaimer: string;
}

const MOOD_SCORES: Record<QuickMood, number> = {
  awful: 1,
  bad: 2,
  okay: 3,
  good: 4,
  great: 5,
};

const client = createApiClient({
  baseUrl: env.apiBaseUrl,
  tokenProvider: supabaseAuthTokenProvider,
});

export const assessmentService = {
  async recordMood(mood: QuickMood): Promise<void> {
    await client.post("/moods", { moodScore: MOOD_SCORES[mood] });
  },
  async scorePhq8(answers: readonly number[]): Promise<Phq8Result> {
    const response = await client.post<{ success: true; data: Phq8Result }, { answers: readonly number[] }>(
      "/assessments/phq8",
      { answers },
    );
    return response.data;
  },
};
