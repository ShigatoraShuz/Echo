export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  EMAIL_IN_USE: "An account with this email already exists.",
  WEAK_PASSWORD: "Password must be at least 8 characters.",
  INVALID_TOKEN: "This reset link is invalid or has expired.",
  EXPIRED_TOKEN: "This reset link has expired. Please request a new one.",
  NETWORK: "Unable to connect. Please check your internet connection.",
  VALIDATION: "Please check the form for errors.",
  UNKNOWN: "Something went wrong. Please try again.",
};
