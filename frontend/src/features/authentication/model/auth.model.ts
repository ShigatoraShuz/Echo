// ─── Domain Types ─────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberSession: boolean;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
  isMockSession: boolean;
}

export type AuthServiceErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_IN_USE"
  | "WEAK_PASSWORD"
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "NETWORK"
  | "VALIDATION"
  | "UNKNOWN";

export interface AuthServiceError {
  code: AuthServiceErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}
