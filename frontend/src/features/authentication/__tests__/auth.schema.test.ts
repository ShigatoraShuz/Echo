import { describe, it, expect } from "vitest";
import {
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} from "@/features/authentication/model/auth.schema";

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
      password: "NewStr0ng!",
      confirmPassword: "NewStr0ng!",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects short password", () => {
    const result = validateResetPasswordInput({
      password: "Short1",
      confirmPassword: "Short1",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it("rejects mismatched passwords", () => {
    const result = validateResetPasswordInput({
      password: "NewStr0ng!",
      confirmPassword: "Different!",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.confirmPassword).toBeDefined();
  });
});
