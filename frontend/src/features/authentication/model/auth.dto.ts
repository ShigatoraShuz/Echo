export interface LoginRequestDTO {
  email: string;
  password: string;
  remember_session: boolean;
}

export interface SignupRequestDTO {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
  privacy_acknowledged: boolean;
}

export interface ForgotPasswordRequestDTO {
  email: string;
}

export interface ResetPasswordRequestDTO {
  token: string;
  password: string;
  confirm_password: string;
}

export interface AuthSessionDTO {
  user: {
    id: string;
    name: string;
    email: string;
  };
  expires_at: string;
  is_mock_session: boolean;
}

export interface AuthMessageDTO {
  message: string;
}
