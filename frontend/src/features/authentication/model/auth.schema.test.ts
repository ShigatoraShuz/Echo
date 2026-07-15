import { describe, it, expect } from "vitest";
import {
  validateLoginInput,
  validateSignupInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} from "./auth.schema";

describe("validateLoginInput", () => {
  it("accepts valid email and password", () => {
    const result = validateLoginInput({ email: "test@example.com", password: "secret123" });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("accepts rememberSession", () => {
    const result = validateLoginInput({ email: "test@example.com", password: "secret123", rememberSession: true });
    expect(result.valid).toBe(true);
  });

  it("rejects empty email", () => {
    const result = validateLoginInput({ email: "", password: "secret123" });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it("rejects invalid email", () => {
    const result = validateLoginInput({ email: "not-an-email", password: "secret123" });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it("rejects empty password", () => {
    const result = validateLoginInput({ email: "test@example.com", password: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });
});

describe("validateSignupInput", () => {
  it("accepts valid signup input", () => {
    const result = validateSignupInput({
      name: "Mira",
      email: "mira@example.com",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      termsAccepted: true,
      privacyAcknowledged: true,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects short name", () => {
    const result = validateSignupInput({
      name: "A",
      email: "mira@example.com",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      termsAccepted: true,
      privacyAcknowledged: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it("rejects short password", () => {
    const result = validateSignupInput({
      name: "Mira",
      email: "mira@example.com",
      password: "Short1",
      confirmPassword: "Short1",
      termsAccepted: true,
      privacyAcknowledged: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it("rejects mismatched passwords", () => {
    const result = validateSignupInput({
      name: "Mira",
      email: "mira@example.com",
      password: "StrongP@ss1",
      confirmPassword: "DifferentP@ss1",
      termsAccepted: true,
      privacyAcknowledged: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.confirmPassword).toBeDefined();
  });

  it("rejects unaccepted terms", () => {
    const result = validateSignupInput({
      name: "Mira",
      email: "mira@example.com",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      termsAccepted: false,
      privacyAcknowledged: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.termsAccepted).toBeDefined();
  });

  it("rejects unacknowledged privacy", () => {
    const result = validateSignupInput({
      name: "Mira",
      email: "mira@example.com",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      termsAccepted: true,
      privacyAcknowledged: false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.privacyAcknowledged).toBeDefined();
  });
});

describe("validateForgotPasswordInput", () => {
  it("accepts valid email", () => {
    const result = validateForgotPasswordInput({ email: "test@example.com" });
    expect(result.valid).toBe(true);
  });

  it("rejects empty email", () => {
    const result = validateForgotPasswordInput({ email: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it("rejects invalid email", () => {
    const result = validateForgotPasswordInput({ email: "bad" });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });
});

describe("validateResetPasswordInput", () => {
  it("accepts valid input", () => {
    const result = validateResetPasswordInput({
      token: "reset-token-123",
      password: "NewStr0ng!",
      confirmPassword: "NewStr0ng!",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty token", () => {
    const result = validateResetPasswordInput({
      token: "",
      password: "NewStr0ng!",
      confirmPassword: "NewStr0ng!",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.token).toBeDefined();
  });

  it("rejects short password", () => {
    const result = validateResetPasswordInput({
      token: "token-123",
      password: "Short1",
      confirmPassword: "Short1",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it("rejects mismatched passwords", () => {
    const result = validateResetPasswordInput({
      token: "token-123",
      password: "NewStr0ng!",
      confirmPassword: "Different!",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.confirmPassword).toBeDefined();
  });
});
