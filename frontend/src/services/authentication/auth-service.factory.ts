import type { AuthService } from "@/services/authentication/auth.service";
import { createAuthMockAdapter } from "@/services/authentication/auth.mock-adapter";
import { createAuthSupabaseAdapter } from "@/services/authentication/auth.supabase-adapter";
import { env } from "@/config/environment";
import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";

let instance: AuthService | null = null;

function createUnavailableAuthService(): AuthService {
  const unavailable = async () => ({
    success: false as const,
    error: {
      code: "UNKNOWN" as const,
      message: "Authentication is not configured. Contact the application administrator.",
    },
  });

  return {
    login: unavailable,
    signup: unavailable,
    forgotPassword: unavailable,
    resetPassword: unavailable,
    getCurrentSession: unavailable,
    logout: unavailable,
  };
}

export function getAuthService(): AuthService {
  if (instance) return instance;

  if (env.dataAdapter !== "http") {
    // Explicit mock mode provides deterministic in-memory accounts for UI work.
    instance = createAuthMockAdapter();
  } else if (getSupabasePublicConfig()) {
    // Supabase is the identity provider when its public configuration is set.
    instance = createAuthSupabaseAdapter();
  } else {
    // Fail closed whenever the configured identity provider is unavailable.
    instance = createUnavailableAuthService();
  }

  return instance;
}

export function resetAuthService(): void {
  instance = null;
}
