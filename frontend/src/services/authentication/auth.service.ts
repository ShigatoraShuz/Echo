import type { AuthSession, LoginInput, SignupInput, SignupResult, ForgotPasswordInput, ResetPasswordInput, AuthServiceError } from "@/features/authentication/model/auth.model";

export type AuthServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: AuthServiceError };

export interface AuthService {
  sendLoginCode?(email: string): Promise<AuthServiceResult<{ message: string }>>;
  verifyLoginCode?(input: { email: string; code: string; rememberSession: boolean }): Promise<AuthServiceResult<AuthSession>>;
  login(input: LoginInput): Promise<AuthServiceResult<AuthSession>>;
  signup(input: SignupInput): Promise<AuthServiceResult<SignupResult>>;
  forgotPassword(input: ForgotPasswordInput): Promise<AuthServiceResult<{ message: string }>>;
  resetPassword(input: ResetPasswordInput): Promise<AuthServiceResult<AuthSession>>;
  getCurrentSession(): Promise<AuthServiceResult<AuthSession | null>>;
  logout(): Promise<AuthServiceResult<void>>;
}
