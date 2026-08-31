import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { env } from "@/config/environment";

const client = () => createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });
export async function createAnalysisHandoff(analysisResultId: string): Promise<string> {
  const response = await client().post<{ data: { handoffId: string } }, { analysisResultId: string }>(
    "/buddy/handoffs",
    { analysisResultId },
  );
  return response.data.handoffId;
}
export async function getAnalysisHandoff(id: string) {
  const response = await client().get<{
    data: { id: string; expiresAt: string; recommendation: { title: string; description: string; activity: string } };
  }>(`/buddy/handoffs/${encodeURIComponent(id)}`);
  return response.data;
}
