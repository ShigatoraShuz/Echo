import type { AuthService } from "./auth.service";
import { createAuthMockAdapter } from "./auth.mock-adapter";
import { createAuthHttpAdapter } from "./auth.http-adapter";

let instance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (instance) return instance;

  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true" || !process.env.NEXT_PUBLIC_API_URL;

  instance = useMock
    ? createAuthMockAdapter()
    : createAuthHttpAdapter();

  return instance;
}

export function resetAuthService(): void {
  instance = null;
}
