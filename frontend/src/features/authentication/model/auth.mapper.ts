import type { AuthSession, LoginInput, SignupInput, ForgotPasswordInput, ResetPasswordInput } from "./auth.model";
import type { LoginRequestDTO, SignupRequestDTO, ForgotPasswordRequestDTO, ResetPasswordRequestDTO, AuthSessionDTO } from "./auth.dto";

export function mapLoginInputToDTO(input: LoginInput): LoginRequestDTO {
  return {
    email: input.email,
    password: input.password,
    remember_session: input.rememberSession,
  };
}

export function mapSignupInputToDTO(input: SignupInput): SignupRequestDTO {
  return {
    name: input.name,
    email: input.email,
    password: input.password,
    confirm_password: input.confirmPassword,
    terms_accepted: input.termsAccepted,
    privacy_acknowledged: input.privacyAcknowledged,
  };
}

export function mapForgotPasswordInputToDTO(input: ForgotPasswordInput): ForgotPasswordRequestDTO {
  return {
    email: input.email,
  };
}

export function mapResetPasswordInputToDTO(input: ResetPasswordInput): ResetPasswordRequestDTO {
  return {
    token: input.token,
    password: input.password,
    confirm_password: input.confirmPassword,
  };
}

export function mapAuthSessionDTO(dto: AuthSessionDTO): AuthSession {
  return {
    user: {
      id: dto.user.id,
      name: dto.user.name,
      email: dto.user.email,
    },
    expiresAt: dto.expires_at,
    isMockSession: dto.is_mock_session,
  };
}
