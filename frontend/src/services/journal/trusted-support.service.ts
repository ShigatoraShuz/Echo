import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type { TrustedContact } from "@/features/settings/model/settings.model";

const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });

export async function getTrustedSupportContacts(): Promise<TrustedContact[]> {
  const result = await client.get<{ data: { trustedContacts: TrustedContact[] } }>("/settings");
  return result.data.trustedContacts;
}

export async function requestTrustedSupportContact(jobId: string, trustedContactId: string): Promise<void> {
  await client.post("/support-contact-requests", { trustedContactId, jobId });
}
