import type { AuthTokenProvider } from "./auth-token-provider";
import { getSupabaseAccessToken } from "@/lib/supabase/auth-helpers";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export const supabaseAuthTokenProvider: AuthTokenProvider = {
  getAccessToken: getSupabaseAccessToken,
  async refreshAccessToken() {
    if (!getSupabasePublicConfig()) return null;
    const { data, error } = await createBrowserSupabaseClient().auth.refreshSession();
    return error ? null : data.session?.access_token ?? null;
  },
  async clearSession() {
    if (!getSupabasePublicConfig()) return;
    await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
  },
};
