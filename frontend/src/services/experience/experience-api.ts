import { env } from "@/config/environment";
import type { ChatMessage } from "@/shared/types";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface BuddySession {
  conversationId: string;
  messages: ChatMessage[];
}

export interface EmotionInsight {
  emotionWheel: Array<{
    label: string;
    mood: "calm" | "happy" | "neutral" | "sad" | "anxious" | "angry";
    value: number;
  }>;
  moodTrend: Array<{ label: string; value: number }>;
  summary: string;
}

export interface GroundingCompletion {
  id: string;
  completedAt: string;
  completedSessions: number;
}

export interface SupportResource {
  id: string;
  type: string;
  organizationName: string;
  name: string;
  description: string;
  phoneNumber: string | null;
  smsNumber: string | null;
  websiteUrl: string | null;
  availability: string;
  countryCode: string;
  regionCode: string | null;
  lastVerifiedAt: string;
}

const client = createApiClient({
  baseUrl: env.apiBaseUrl,
  tokenProvider: supabaseAuthTokenProvider,
});

export const experienceApi = {
  async getBuddySession(): Promise<BuddySession> {
    return (await client.get<ApiEnvelope<BuddySession>>("/buddy/session")).data;
  },
  async sendBuddyMessage(content: string): Promise<BuddySession> {
    return (
      await client.post<ApiEnvelope<BuddySession>, { content: string }>("/buddy/messages", {
        content,
      })
    ).data;
  },
  async getEmotionInsights(): Promise<EmotionInsight> {
    return (await client.get<ApiEnvelope<EmotionInsight>>("/insights/emotions")).data;
  },
  async completeGrounding(input: {
    technique: string;
    durationSeconds: number;
    pace: "gentle" | "slower" | "steady";
  }): Promise<GroundingCompletion> {
    return (
      await client.post<ApiEnvelope<GroundingCompletion>, typeof input>(
        "/grounding/sessions",
        input,
      )
    ).data;
  },
  async getSupportResources(filters?: {
    query?: string;
    type?: string;
  }): Promise<SupportResource[]> {
    const params = new URLSearchParams();
    if (filters?.query) params.set("q", filters.query);
    if (filters?.type && filters.type !== "all") params.set("type", filters.type);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return (
      await client.get<ApiEnvelope<SupportResource[]>>(`/support-resources${suffix}`)
    ).data;
  },
};
