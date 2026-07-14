import { describe, it, expect, beforeEach } from "vitest";
import { createAuthMockAdapter } from "./auth.mock-adapter";
import type { AuthService } from "./auth.service";

describe("AuthMockAdapter", () => {
  let adapter: AuthService;

  beforeEach(() => {
    adapter = createAuthMockAdapter();
  });

  describe("login", () => {
    it("returns session for valid credentials", async () => {
      const result = await adapter.login({ email: "test@example.com", password: "password123", rememberSession: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe("test@example.com");
        expect(result.data.isMockSession).toBe(true);
      }
    });

    it("returns VALIDATION error for empty email", async () => {
      const result = await adapter.login({ email: "", password: "password123", rememberSession: false });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION");
      }
    });

    it("returns VALIDATION error for empty password", async () => {
      const result = await adapter.login({ email: "test@example.com", password: "", rememberSession: false });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION");
      }
    });
  });

  describe("signup", () => {
    it("returns session for valid input", async () => {
      const result = await adapter.signup({
        name: "Mira",
        email: "mira@example.com",
        password: "StrongP@ss1",
        confirmPassword: "StrongP@ss1",
        termsAccepted: true,
        privacyAcknowledged: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.name).toBe("Mira");
        expect(result.data.isMockSession).toBe(true);
      }
    });

    it("returns validation errors for invalid input", async () => {
      const result = await adapter.signup({
        name: "",
        email: "bad",
        password: "short",
        confirmPassword: "mismatch",
        termsAccepted: false,
        privacyAcknowledged: false,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION");
        expect(result.error.fieldErrors).toBeDefined();
        expect(result.error.fieldErrors!.name).toBeDefined();
        expect(result.error.fieldErrors!.email).toBeDefined();
        expect(result.error.fieldErrors!.password).toBeDefined();
        expect(result.error.fieldErrors!.confirmPassword).toBeDefined();
        expect(result.error.fieldErrors!.termsAccepted).toBeDefined();
        expect(result.error.fieldErrors!.privacyAcknowledged).toBeDefined();
      }
    });
  });

  describe("forgotPassword", () => {
    it("returns success message for valid email", async () => {
      const result = await adapter.forgotPassword({ email: "test@example.com" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain("test@example.com");
      }
    });

    it("returns VALIDATION error for invalid email", async () => {
      const result = await adapter.forgotPassword({ email: "invalid" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION");
      }
    });
  });

  describe("resetPassword", () => {
    it("returns session for valid input", async () => {
      const result = await adapter.resetPassword({
        token: "valid-token",
        password: "NewStr0ng!",
        confirmPassword: "NewStr0ng!",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isMockSession).toBe(true);
      }
    });

    it("returns WEAK_PASSWORD for short password", async () => {
      const result = await adapter.resetPassword({
        token: "token",
        password: "short",
        confirmPassword: "short",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("WEAK_PASSWORD");
      }
    });

    it("returns VALIDATION for mismatched passwords", async () => {
      const result = await adapter.resetPassword({
        token: "token",
        password: "NewStr0ng!",
        confirmPassword: "Different!",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION");
      }
    });
  });

  describe("getCurrentSession", () => {
    it("returns null initially", async () => {
      const result = await adapter.getCurrentSession();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it("returns session after login", async () => {
      await adapter.login({ email: "test@example.com", password: "password", rememberSession: false });
      const result = await adapter.getCurrentSession();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toBeNull();
        expect(result.data!.user.email).toBe("test@example.com");
      }
    });
  });

  describe("logout", () => {
    it("clears session", async () => {
      await adapter.login({ email: "test@example.com", password: "password", rememberSession: false });
      await adapter.logout();
      const result = await adapter.getCurrentSession();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });
});
