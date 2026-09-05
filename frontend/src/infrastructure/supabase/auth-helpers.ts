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
