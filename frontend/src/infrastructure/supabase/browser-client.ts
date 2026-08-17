"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicConfig } from "@/infrastructure/supabase/config";

let browserClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, publishableKey } = requireSupabasePublicConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
