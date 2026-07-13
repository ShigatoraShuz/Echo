import { AppError } from "@/shared/errors/app-error";
import type { ErrorCode } from "@/shared/errors/error-codes";
import { getUserMessageForCode } from "@/shared/errors/error-messages";

function isAbortError(value: unknown): boolean {
  if (value instanceof DOMException) {
    return value.name === "AbortError";
  }
  if (value instanceof Error) {
    return value.name === "AbortError";
  }
  return false;
}

function isTimeoutError(value: unknown): boolean {
  if (value instanceof TypeError && value.message === "The operation was aborted due to timeout") {
    return true;
  }
  return false;
}

function isNetworkError(value: unknown): boolean {
  if (value instanceof TypeError && value.message === "Failed to fetch") {
    return true;
  }
  if (value instanceof TypeError && value.message.includes("NetworkError")) {
    return true;
  }
  return false;
}

function extractStatus(value: unknown): number | undefined {
  if (value && typeof value === "object" && "status" in value) {
    const s = (value as { status: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

function hasFieldErrors(value: unknown): boolean {
  if (value && typeof value === "object" && "fieldErrors" in value) {
    return Array.isArray((value as { fieldErrors: unknown }).fieldErrors);
  }
  return false;
}

function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (isAbortError(error)) {
    return new AppError({
      code: "TIMEOUT",
      userMessage: "The request was cancelled.",
      developerMessage: "Request was aborted",
      retryable: true,
      cause: error,
    });
  }

  if (isTimeoutError(error)) {
    return new AppError({
      code: "TIMEOUT",
      userMessage: getUserMessageForCode("TIMEOUT"),
      developerMessage: "Request timed out",
      retryable: true,
      cause: error,
    });
  }

  if (isNetworkError(error)) {
    return new AppError({
      code: "NETWORK_ERROR",
      userMessage: getUserMessageForCode("NETWORK_ERROR"),
      developerMessage: "Network request failed",
      retryable: true,
      cause: error,
    });
  }

  if (error && typeof error === "object" && "code" in error) {
    const candidate = error as { code: unknown; message?: unknown; userMessage?: unknown };
    if (typeof candidate.code === "string") {
      const code = candidate.code as ErrorCode;
      return new AppError({
        code,
        userMessage:
          (typeof candidate.userMessage === "string" ? candidate.userMessage : undefined) ??
          getUserMessageForCode(code),
        developerMessage: typeof candidate.message === "string" ? candidate.message : undefined,
        statusCode: extractStatus(error),
        fieldErrors: hasFieldErrors(error)
          ? (error as Record<string, unknown>).fieldErrors as AppError["fieldErrors"]
          : undefined,
        retryable: code === "NETWORK_ERROR" || code === "TIMEOUT" || code === "RATE_LIMITED",
        cause: error,
      });
    }
  }

  if (error instanceof Error) {
    return new AppError({
      code: "UNKNOWN_ERROR",
      userMessage: getUserMessageForCode("UNKNOWN_ERROR"),
      developerMessage: error.message || undefined,
      retryable: false,
      cause: error,
    });
  }

  if (typeof error === "string") {
    return new AppError({
      code: "UNKNOWN_ERROR",
      userMessage: getUserMessageForCode("UNKNOWN_ERROR"),
      developerMessage: error,
      retryable: false,
      cause: error,
    });
  }

  return new AppError({
    code: "UNKNOWN_ERROR",
    userMessage: getUserMessageForCode("UNKNOWN_ERROR"),
    developerMessage: "An unknown error occurred",
    retryable: false,
    cause: error,
  });
}
