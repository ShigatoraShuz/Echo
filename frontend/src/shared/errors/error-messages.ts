import type { ErrorCode } from "@/shared/errors/error-codes";

export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Please check your input and try again.",
  AUTHENTICATION_ERROR: "Your session has expired. Please log in again.",
  AUTHORIZATION_ERROR: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  CONFLICT: "This item was updated by another session. Please refresh.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
  TIMEOUT: "The request took too long. Please try again.",
  SERVER_ERROR: "Something went wrong on our end. Please try again later.",
  UNKNOWN_ERROR: "Something unexpected happened. Please try again.",
};

export function getUserMessageForCode(code: ErrorCode): string {
  return DEFAULT_ERROR_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGES.UNKNOWN_ERROR;
}
