import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import type { AuthSession } from "@/features/authentication/model/auth.model";
import type { AuthService, AuthServiceResult } from "@/services/authentication/auth.service";

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
  const code =
    error?.code === "otp_expired" || lower.includes("expired")
      ? "EXPIRED_TOKEN"
      : lower.includes("token") || lower.includes("otp")
        ? "INVALID_TOKEN"
        : lower.includes("invalid login")
          ? "INVALID_CREDENTIALS"
          : lower.includes("already registered") || lower.includes("already exists")
            ? "EMAIL_IN_USE"
            : lower.includes("password")
              ? "WEAK_PASSWORD"
              : "UNKNOWN";
  return { success: false, error: { code, message } };
}

export function createAuthSupabaseAdapter(): AuthService {
  const client = createBrowserSupabaseClient();

  return {
    async requestEmailCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) return failure(error);
      return {
        success: true,
        data: { message: "If this account can sign in, a code has been sent. Check your inbox." },
      };
    },
    async login(input) {
      if (!input.code || !/^\d{6}$/.test(input.code))
        return {
          success: false,
          error: { code: "INVALID_TOKEN", message: "Enter the six-digit code from your email." },
        };
      const { data, error } = await client.auth.verifyOtp({ email: input.email, token: input.code, type: "email" });
      if (error || !data.session) return failure(error);
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
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) return failure(error);
      return { success: true, data: undefined };
    },
  };
}
