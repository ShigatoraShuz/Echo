"use client";

import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!getSupabasePublicConfig()) return null;

  const result = await Promise.race([
    createBrowserSupabaseClient().auth.getSession(),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 5_000);
    }),
  ]);
  if (!result) return null;
  const { data, error } = result;
  if (error) return null;
  return data.session?.access_token ?? null;
}

export async function signInWithGoogle(
  redirectTo: string,
  options: { forceAccountSelection?: boolean } = {},
): Promise<{ error: string | null; didRedirect: boolean }> {
  const { data, error } = await createBrowserSupabaseClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: options.forceAccountSelection ? { prompt: "select_account" } : undefined,
    },
  });

  if (!error && data.url) {
    window.location.assign(data.url);
    return { error: null, didRedirect: true };
  }
  return { error: error?.message ?? null, didRedirect: false };
}
