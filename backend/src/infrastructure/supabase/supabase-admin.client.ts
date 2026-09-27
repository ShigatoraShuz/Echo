import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BackendEnvironment } from "../../config/environment.js";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import type { Database } from "./database.types.js";
import { createResilientFetch } from "./resilient-fetch.js";

export function createSupabaseAdminClient(environment: BackendEnvironment): SupabaseClient {
  return createClient<Database>(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createResilientFetch() },
  });
}

export function createSupabasePublicServerClient(environment: BackendEnvironment): SupabaseClient {
  return createClient<Database>(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: createResilientFetch() },
  });
}

export function createSupabaseAccessTokenVerifier(client: SupabaseClient, supabaseUrl: string): AccessTokenVerifier {
  const issuer = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  return {
    async getUser(accessToken) {
      if (accessToken.length > 16_384) return null;
      const parts = accessToken.split(".");
      if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
      let claims: Record<string, unknown>;
      try { claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); }
      catch { return null; }
      const now = Math.floor(Date.now() / 1000);
      if (!claims || claims.iss !== issuer || claims.aud !== "authenticated" ||
          claims.role !== "authenticated" || typeof claims.exp !== "number" || claims.exp <= now ||
          typeof claims.iat !== "number" || claims.iat > now + 30 ||
          (typeof claims.nbf === "number" && claims.nbf > now) ||
          typeof claims.sub !== "string" || typeof claims.session_id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)) return null;
      // Validate the bearer token with Supabase Auth rather than decoding it
      // locally. This also supports projects that still use a symmetric JWT
      // secret, where local JWKS claim verification is not available.
      const { data, error } = await client.auth.getUser(accessToken);
      const user = data.user;
      if (error || !user || user.id !== claims.sub) return null;
      // Claims above are only rejection hints until Auth verifies the exact
      // token. No unsigned claim is used for authorization.
      const session = await client.schema("user_service").rpc("security_session_active", {
        p_user_id: user.id, p_session_id: claims.session_id,
      });
      if (session.error || session.data !== true) return null;
      const authenticationTimes = Array.isArray(claims.amr) ? claims.amr.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== "object") return [];
        const method = entry as { method?: unknown; timestamp?: unknown };
        return typeof method.method === "string" && ["password", "otp", "oauth", "totp", "mfa/totp", "mfa/phone"].includes(method.method) &&
          typeof method.timestamp === "number" && method.timestamp <= now + 30 ? [method.timestamp] : [];
      }) : [];
      return {
        id: user.id,
        email: user.email,
        emailVerified: Boolean(user.email_confirmed_at),
        sessionId: claims.session_id,
        assuranceLevel: claims.aal === "aal2" ? "aal2" : "aal1",
        authenticatedAt: authenticationTimes.length ? Math.max(...authenticationTimes) : undefined,
      };
    },
  };
}
