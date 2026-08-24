import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import type { AuthSession } from "@/features/authentication/model/auth.model";
import { SIGNUP_CONSENT_VERSION } from "@/features/authentication/model/auth.schema";
import type { AuthService, AuthServiceResult } from "@/services/authentication/auth.service";

function toSession(session: Session): AuthSession {
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name:
        typeof session.user.user_metadata?.display_name === "string"
          ? session.user.user_metadata.display_name
          : session.user.email?.split("@")[0] ?? "ECHO member",
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
    : lower.includes("already registered") || lower.includes("already exists")
      ? "EMAIL_IN_USE"
      : lower.includes("password")
        ? "WEAK_PASSWORD"
        : "UNKNOWN";
  return {
    success: false,
    error: {
      code,
      message: code === "EMAIL_IN_USE" ? "This email has already been used. Log in instead." : message,
      fieldErrors: code === "EMAIL_IN_USE" ? { email: ["This email has already been used."] } : undefined,
    },
  };
}

function registerVolatileSession(client: ReturnType<typeof createBrowserSupabaseClient>): () => void {
  const signOutOnClose = () => {
    // Sign out at most once; if the user cancels the close, the session
    // simply survives until the next explicit logout or tab close.
    window.removeEventListener("beforeunload", signOutOnClose);
    void client.auth.signOut({ scope: "local" });
  };
  window.addEventListener("beforeunload", signOutOnClose);
  return () => {
    window.removeEventListener("beforeunload", signOutOnClose);
  };
}

export function createAuthSupabaseAdapter(): AuthService {
  const client = createBrowserSupabaseClient();
  let removeVolatileListener: (() => void) | null = null;

  return {
    async login(input) {
      const { data, error } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error || !data.session) return failure(error);

      // "Remember me" unchecked keeps the session alive for navigation but
      // ends it when the browser tab closes. Supabase cannot scope cookie
      // persistence per sign-in, so the session is signed out on unload.
      removeVolatileListener?.();
      removeVolatileListener = input.rememberSession
        ? null
        : registerVolatileSession(client);

      return { success: true, data: toSession(data.session) };
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
      if (error) return failure(error);
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        return failure({ message: "This email already exists." });
      }
      if (!data.session) {
        return {
          success: true,
          data: {
            requiresEmailConfirmation: true,
            email: input.email,
            message: `We sent a confirmation link to ${input.email}. Open that email to continue your signup.`,
          },
        };
      }
      const { error: profileError } = await client
        .schema("user_service")
        .from("profiles")
        .update({ display_name: input.name })
        .eq("user_id", data.session.user.id);
      if (profileError) {
        // The auth trigger creates the profile row; losing this write only
        // leaves the trigger's default display name in place.
        console.warn("[auth.supabase] Could not persist display name on signup", profileError.message);
      }
      return { success: true, data: toSession(data.session) };
    },
    async forgotPassword(input) {
      const callback = new URL("/callback", window.location.origin);
      callback.searchParams.set("next", "/reset-password");
      const redirectTo = callback.toString();
      const { error } = await client.auth.resetPasswordForEmail(input.email, { redirectTo });
      if (error) return failure(error);
      return {
        success: true,
        data: { message: `If an account exists for ${input.email}, a reset link has been sent.` },
      };
    },
    async resetPassword(input) {
      const { data, error } = await client.auth.updateUser({ password: input.password });
      if (error || !data.user) return failure(error);
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) return failure({ message: "Your reset session has expired." });
      return { success: true, data: toSession(sessionData.session) };
    },
    async getCurrentSession() {
      const { data, error } = await client.auth.getSession();
      if (error) return failure(error);
      return { success: true, data: data.session ? toSession(data.session) : null };
    },
    async logout() {
      // End only this browser's session. Supabase still clears local auth
      // storage and emits SIGNED_OUT for the current client.
      removeVolatileListener?.();
      removeVolatileListener = null;
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) return failure(error);
      return { success: true, data: undefined };
    },
  };
}
