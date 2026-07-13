import type { AuthService, AuthServiceResult } from "./auth.service";

function notImplemented(): AuthServiceResult<never> {
  return { success: false, error: { code: "NETWORK", message: "Auth HTTP adapter not yet connected" } };
}

export function createAuthHttpAdapter(): AuthService {
  return {
    async login() { return notImplemented(); },
    async signup() { return notImplemented(); },
    async forgotPassword() { return notImplemented(); },
    async resetPassword() { return notImplemented(); },
    async getCurrentSession() { return notImplemented(); },
    async logout() { return notImplemented(); },
  };
}
