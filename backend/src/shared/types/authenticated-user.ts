export interface AuthenticatedUser {
  id: string;
  email?: string;
  emailVerified?: boolean;
  sessionId?: string;
  accessToken?: string;
}
