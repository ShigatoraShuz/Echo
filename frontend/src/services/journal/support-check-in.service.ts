import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { supportCheckInSchema, type SupportCheckIn } from "@/features/journal/model/support-journey";

export async function getJournalSupportCheckIn(): Promise<SupportCheckIn> {
  const response = await createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  }).get<{ data: unknown }>("/journal-support/check-in", { timeout: 5000 });
  return supportCheckInSchema.parse(response.data);
}
