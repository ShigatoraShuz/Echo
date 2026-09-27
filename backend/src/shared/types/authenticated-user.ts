export interface AuthenticatedUser {
  id: string;
  email?: string;
  emailVerified?: boolean;
  sessionId?: string;
  accessToken?: string;
  assuranceLevel?: "aal1" | "aal2";
  authenticatedAt?: number;
}
