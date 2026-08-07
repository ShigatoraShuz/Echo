import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BackendEnvironment } from "../../config/environment.js";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";

export function createSupabaseAdminClient(environment: BackendEnvironment): SupabaseClient {
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createSupabaseAccessTokenVerifier(client: SupabaseClient): AccessTokenVerifier {
  return {
    async getUser(accessToken) {
      // Validate the bearer token with Supabase Auth rather than decoding it
      // locally. This also supports projects that still use a symmetric JWT
      // secret, where local JWKS claim verification is not available.
      const { data, error } = await client.auth.getUser(accessToken);
      const user = data.user;
      if (error || !user) return null;
      return {
        id: user.id,
        email: user.email,
      };
    },
  };
}
