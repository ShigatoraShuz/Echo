import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BackendEnvironment } from "../../config/environment.js";
import { currentAccessToken } from "../../shared/request-context.js";
import { createResilientFetch } from "./resilient-fetch.js";

// No service-role fallback. Each client is bound to the verified token of one
// request; it is never shared with another user or stored in global auth state.
export function createRequestUserClient(environment: BackendEnvironment): SupabaseClient {
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${currentAccessToken()}` }, fetch: createResilientFetch() },
  });
}
