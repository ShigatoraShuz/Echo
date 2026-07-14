import { describe, it, expect } from "vitest";
import { normalizeError } from "./normalize-error";
import { AppError } from "./app-error";

describe("normalizeError", () => {
  it("passes through AppError instances unchanged", () => {
    const original = new AppError({
      code: "NOT_FOUND",
      userMessage: "Not found",
    });
    const result = normalizeError(original);
    expect(result).toBe(original);
    expect(result.code).toBe("NOT_FOUND");
  });

  it("handles plain Error instances", () => {
    const result = normalizeError(new Error("something broke"));
    expect(result.code).toBe("UNKNOWN_ERROR");
    expect(result.userMessage).toBe("Something unexpected happened. Please try again.");
  });

  it("handles string thrown values", () => {
    const result = normalizeError("just a string");
    expect(result.code).toBe("UNKNOWN_ERROR");
  });

  it("handles unknown thrown values", () => {
    const result = normalizeError(42);
    expect(result.code).toBe("UNKNOWN_ERROR");
  });

  it("handles null thrown values", () => {
    const result = normalizeError(null);
    expect(result.code).toBe("UNKNOWN_ERROR");
  });

  it("handles undefined thrown values", () => {
    const result = normalizeError(undefined);
    expect(result.code).toBe("UNKNOWN_ERROR");
  });

  it("converts AbortError to TIMEOUT", () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const result = normalizeError(abortError);
    expect(result.code).toBe("TIMEOUT");
    expect(result.userMessage).toBe("The request was cancelled.");
    expect(result.retryable).toBe(true);
  });

  it("converts AbortError Error to TIMEOUT", () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const result = normalizeError(abortError);
    expect(result.code).toBe("TIMEOUT");
    expect(result.retryable).toBe(true);
  });

  it("converts TimeoutError to TIMEOUT", () => {
    const timeoutError = new TypeError("The operation was aborted due to timeout");
    const result = normalizeError(timeoutError);
    expect(result.code).toBe("TIMEOUT");
    expect(result.retryable).toBe(true);
  });

  it("converts NetworkError to NETWORK_ERROR", () => {
    const netError = new TypeError("Failed to fetch");
    const result = normalizeError(netError);
    expect(result.code).toBe("NETWORK_ERROR");
    expect(result.retryable).toBe(true);
  });

  it("handles objects with code property", () => {
    const result = normalizeError({ code: "NOT_FOUND", message: "missing" });
    expect(result.code).toBe("NOT_FOUND");
    expect(result.retryable).toBe(false);
  });

  it("provides user-safe messages for all error types", () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    expect(normalizeError(abortError).userMessage).toBe("The request was cancelled.");

    const timeoutError = new TypeError("The operation was aborted due to timeout");
    expect(normalizeError(timeoutError).userMessage).toBe("The request took too long. Please try again.");

    const netError = new TypeError("Failed to fetch");
    expect(normalizeError(netError).userMessage).toBe("Unable to connect. Please check your internet connection.");
  });

  it("does not copy sensitive metadata into developer-facing output when metadata exists", () => {
    const result = normalizeError({
      code: "VALIDATION_ERROR",
      message: "invalid",
      metadata: { password: "secret123", token: "abc" },
    });
    expect(result.developerMessage).toBe("invalid");
  });
});
