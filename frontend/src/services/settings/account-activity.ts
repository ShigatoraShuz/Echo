import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { env } from "@/config/environment";
const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });
export async function resetAccountActivity(requestId: string) {
  const result = await client.post<{ success: boolean; data: { reset: boolean } }>("/settings/activity-reset", {
    requestId,
    confirmation: "START CLEAN",
  });
  if (!result.success || !result.data.reset) throw new Error("Your reset could not be confirmed. Please retry.");
}
export async function requestBuddyInvitation() {
  const result = await client.post<{ success: boolean; data: { show: boolean } }>("/buddy/wellbeing-invitation", {});
  return result.success && result.data.show;
}

export async function reauthenticateActivityReset(password: string) {
  const client = createBrowserSupabaseClient();
  const current = await client.auth.getUser();
  if (!current.data.user?.email) throw new Error("Sign in again before resetting your activity.");
  const result = await client.auth.signInWithPassword({ email: current.data.user.email, password });
  if (result.error || !result.data.user)
    throw new Error("Your password could not be verified. No reset was requested.");
  return result.data.user.id;
}
