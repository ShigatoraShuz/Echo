import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

interface ApiEnvelope<T> {
  success: true;
  data: T;
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

export const supportResourcesApi = {
  async list(filters?: { query?: string; type?: string }): Promise<SupportResource[]> {
    const params = new URLSearchParams();
    if (filters?.query) params.set("q", filters.query);
    if (filters?.type && filters.type !== "all") params.set("type", filters.type);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return (
      await client.get<ApiEnvelope<SupportResource[]>>(`/support-resources${suffix}`)
    ).data;
  },
};
