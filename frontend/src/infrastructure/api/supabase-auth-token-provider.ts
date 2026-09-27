import type { AuthTokenProvider } from "@/infrastructure/api/auth-token-provider";
import { getSupabaseAccessToken } from "@/infrastructure/supabase/auth-helpers";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { clearSensitiveBrowserState } from "@/infrastructure/security/clear-sensitive-state";

export const supabaseAuthTokenProvider: AuthTokenProvider = {
  getAccessToken: getSupabaseAccessToken,
  async refreshAccessToken() {
    if (!getSupabasePublicConfig()) return null;
    const { data, error } = await createBrowserSupabaseClient().auth.refreshSession();
    return error ? null : data.session?.access_token ?? null;
  },
  async clearSession() {
    clearSensitiveBrowserState();
    if (!getSupabasePublicConfig()) return;
    await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
  },
};
