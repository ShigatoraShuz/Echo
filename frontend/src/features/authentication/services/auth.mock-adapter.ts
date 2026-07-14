import type { AuthService } from "./auth.service";
import type { AuthSession } from "../model/auth.model";

export function createAuthMockAdapter(): AuthService {
  let currentSession: AuthSession | null = null;

  async function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  return {
    async login(input) {
      await delay(500 + Math.random() * 500);

      if (!input.email || !input.password) {
        return { success: false, error: { code: "VALIDATION", message: "Email and password are required." } };
      }

      if (input.password.length < 1) {
        return { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } };
      }

      const session: AuthSession = {
        user: { id: "mock-user-1", name: "Mira", email: input.email },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isMockSession: true,
      };
      currentSession = session;
      return { success: true, data: session };
    },

    async signup(input) {
      await delay(600 + Math.random() * 400);

      const fieldErrors: Record<string, string[]> = {};
      if (!input.name || input.name.trim().length < 2) {
        fieldErrors.name = ["Name must be at least 2 characters."];
      }
      if (!input.email || !input.email.includes("@")) {
        fieldErrors.email = ["Please enter a valid email address."];
      }
      if (!input.password || input.password.length < 8) {
        fieldErrors.password = ["Password must be at least 8 characters."];
      }
      if (input.password !== input.confirmPassword) {
        fieldErrors.confirmPassword = ["Passwords do not match."];
      }
      if (!input.termsAccepted) {
        fieldErrors.termsAccepted = ["You must accept the terms of use."];
      }
      if (!input.privacyAcknowledged) {
        fieldErrors.privacyAcknowledged = ["You must acknowledge the privacy policy."];
      }

      if (Object.keys(fieldErrors).length > 0) {
        return { success: false, error: { code: "VALIDATION", message: "Please check the form for errors.", fieldErrors } };
      }

      const session: AuthSession = {
        user: { id: "mock-user-new", name: input.name, email: input.email },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isMockSession: true,
      };
      currentSession = session;
      return { success: true, data: session };
    },

    async forgotPassword(input) {
      await delay(400 + Math.random() * 300);
      if (!input.email || !input.email.includes("@")) {
        return { success: false, error: { code: "VALIDATION", message: "Please enter a valid email address." } };
      }
      return { success: true, data: { message: `If an account exists for ${input.email}, a reset link has been sent.` } };
    },

    async resetPassword(input) {
      await delay(500 + Math.random() * 300);
      if (input.password.length < 8) {
        return { success: false, error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters." } };
      }
      if (input.password !== input.confirmPassword) {
        return { success: false, error: { code: "VALIDATION", message: "Passwords do not match." } };
      }
      const session: AuthSession = {
        user: { id: "mock-user-reset", name: "User", email: "user@example.com" },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isMockSession: true,
      };
      currentSession = session;
      return { success: true, data: session };
    },

    async getCurrentSession() {
      await delay(100);
      return { success: true, data: currentSession };
    },

    async logout() {
      await delay(100);
      currentSession = null;
      return { success: true, data: undefined };
    },
  };
}
