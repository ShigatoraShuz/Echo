import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
export interface FeaturePolicy {
  canUseAiFeatures: boolean;
  canUseBuddy: boolean;
  verificationStatus: string;
  hasTrustedContact: boolean;
  missingRequirements: string[];
}
const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });
export async function getFeaturePolicy(): Promise<FeaturePolicy> {
  return (await client.get<{ data: FeaturePolicy }>("/access/features")).data;
}
