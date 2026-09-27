import { clearSensitiveBrowserState } from "@/infrastructure/security/clear-sensitive-state";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import type { AuthSession } from "@/features/authentication/model/auth.model";
import { SIGNUP_CONSENT_VERSION } from "@/features/authentication/model/auth.schema";
import type { AuthService, AuthServiceResult } from "@/services/authentication/auth.service";

const SESSION_PERSISTENCE_KEY = "echo.auth.session-persistence";
const VOLATILE_SESSION_MARKER_KEY = "echo.auth.volatile-session-active";
const VOLATILE_SESSION_VALUE = "session";

function toSession(session: Session): AuthSession {
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name:
        typeof session.user.user_metadata?.display_name === "string"
          ? session.user.user_metadata.display_name
          : (session.user.email?.split("@")[0] ?? "ECHO member"),
    },
    expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
    isMockSession: false,
  };
}

function failure(error: { message: string; code?: string } | null): AuthServiceResult<never> {
  const message = error?.message ?? "Authentication could not be completed.";
  const lower = message.toLowerCase();

  const code = lower.includes("invalid login")
    ? "INVALID_CREDENTIALS"
      : lower.includes("password")
        ? "WEAK_PASSWORD"
        : "UNKNOWN";

  return {
    success: false,
    error: {
      code,
      message: error?.code === "otp_expired" || lower.includes("invalid or has expired") ? "The code is invalid or has expired. Request a new code." : code === "INVALID_CREDENTIALS" ? "Invalid email or password." : code === "WEAK_PASSWORD" ? "The password does not meet the required policy." : "Authentication could not be completed. Please try again.",
    },
  };
}

function configureSessionPersistence(rememberSession: boolean): void {
  if (typeof window === "undefined") return;

  try {
    if (rememberSession) {
      window.localStorage.removeItem(SESSION_PERSISTENCE_KEY);
      window.sessionStorage.removeItem(VOLATILE_SESSION_MARKER_KEY);
      return;
    }

    window.localStorage.setItem(SESSION_PERSISTENCE_KEY, VOLATILE_SESSION_VALUE);

    window.sessionStorage.setItem(VOLATILE_SESSION_MARKER_KEY, "active");
  } catch {
    // Storage may be unavailable in restrictive/private browser contexts.
    // Authentication should still continue normally.
  }
}

function clearSessionPersistenceState(): void {
  clearSensitiveBrowserState();
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SESSION_PERSISTENCE_KEY);
    window.sessionStorage.removeItem(VOLATILE_SESSION_MARKER_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

function shouldExpireVolatileSession(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const persistenceMode = window.localStorage.getItem(SESSION_PERSISTENCE_KEY);

    if (persistenceMode !== VOLATILE_SESSION_VALUE) {
      return false;
    }

    return window.sessionStorage.getItem(VOLATILE_SESSION_MARKER_KEY) !== "active";
  } catch {
    return false;
  }
}

export function createAuthSupabaseAdapter(): AuthService {
  const client = createBrowserSupabaseClient();

  return {
    async sendLoginCode(email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        return failure({
          message: "We could not send a code. Check your email address and try again shortly.",
        });
      }

      return {
        success: true,
        data: {
          message: "If this email has an ECHO account, a sign-in code is on its way.",
        },
      };
    },

    async verifyLoginCode(input) {
      const { data, error } = await client.auth.verifyOtp({
        email: input.email,
        token: input.code,
        type: "email",
      });

      if (error || !data.session) {
        return failure({
          message: "This code is invalid or has expired. Try again or request a new code.",
        });
      }

      configureSessionPersistence(input.rememberSession);

      return {
        success: true,
        data: toSession(data.session),
      };
    },

    async login(input) {
      const { data, error } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error || !data.session) {
        return failure(error);
      }

      /*
       * Supabase persists browser auth sessions by default.
       *
       * For a non-remembered login, ECHO marks the session as volatile.
       * sessionStorage survives a normal refresh, so refreshing must NOT
       * sign the user out.
       *
       * When a later browser session starts without the matching
       * sessionStorage marker, getCurrentSession() expires the local
       * Supabase session.
       */
      configureSessionPersistence(input.rememberSession);

      return {
        success: true,
        data: toSession(data.session),
      };
    },

    async signup(input) {
      const callback = new URL("/callback", window.location.origin);

      callback.searchParams.set("next", "/onboarding/consent");
      callback.searchParams.set("intent", "signup");

      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: callback.toString(),
          data: {
            display_name: input.name,
            signup_consent: {
              version: SIGNUP_CONSENT_VERSION,
              terms_accepted: input.termsAccepted,
              privacy_acknowledged: input.privacyAcknowledged,
              data_processing_acknowledged: input.dataProcessingAcknowledged,
              ai_feature_acknowledged: input.aiFeatureAcknowledged,
              journal_analysis_consent: input.journalAnalysisConsent,
            },
          },
        },
      });

      const duplicate = error && ["email_exists", "user_already_exists"].includes(error.code ?? "");
      if (error && !duplicate) return failure(error);
      if (duplicate || !data.session || (Array.isArray(data.user?.identities) && data.user.identities.length === 0)) {
        return {
          success: true,
          data: {
            requiresEmailConfirmation: true,
            email: input.email,
            message: "If this address can register, a confirmation email will arrive. You can also sign in or request a password reset.",
          },
        };
      }

      clearSessionPersistenceState();

      const { error: profileError } = await client
        .schema("user_service")
        .from("profiles")
        .update({
          display_name: input.name,
        })
        .eq("user_id", data.session.user.id);

      if (profileError) {
        // The auth trigger creates the profile row; losing this write only
        // leaves the trigger's default display name in place.
        console.warn("[auth.supabase] Could not persist display name on signup");
      }

      return {
        success: true,
        data: toSession(data.session),
      };
    },

    async forgotPassword(input) {
      const callback = new URL("/callback", window.location.origin);

      callback.searchParams.set("next", "/reset-password");

      const redirectTo = callback.toString();

      const { error } = await client.auth.resetPasswordForEmail(input.email, {
        redirectTo,
      });

      if (error) {
        return failure(error);
      }

      return {
        success: true,
        data: {
          message: `If an account exists for ${input.email}, a reset link has been sent.`,
        },
      };
    },

    async resetPassword(input) {
      const { data, error } = await client.auth.updateUser({
        password: input.password,
      });

      if (error || !data.user) {
        return failure(error);
      }

      const { data: sessionData } = await client.auth.getSession();

      if (!sessionData.session) {
        return failure({
          message: "Your reset session has expired.",
        });
      }

      return {
        success: true,
        data: toSession(sessionData.session),
      };
    },

    async getCurrentSession() {
      const { data, error } = await client.auth.getSession();

      if (error) {
        return failure(error);
      }

      if (!data.session) {
        clearSessionPersistenceState();

        return {
          success: true,
          data: null,
        };
      }

      if (shouldExpireVolatileSession()) {
        const { error: signOutError } = await client.auth.signOut({
          scope: "local",
        });

        if (signOutError) {
          return failure(signOutError);
        }

        clearSessionPersistenceState();

        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: toSession(data.session),
      };
    },

    async logout() {
      const { error } = await client.auth.signOut({
        scope: "local",
      });

      if (error) {
        return failure(error);
      }

      clearSessionPersistenceState();

      return {
        success: true,
        data: undefined,
      };
    },
  };
}
