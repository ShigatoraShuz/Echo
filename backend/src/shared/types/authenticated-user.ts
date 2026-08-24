export interface AuthenticatedUser {
  id: string;
  email?: string;
  sessionId?: string;
  accessToken?: string;
}
