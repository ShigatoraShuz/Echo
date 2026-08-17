export interface AuthTokenProvider {
  getAccessToken(): Promise<string | null>;
  refreshAccessToken(): Promise<string | null>;
  clearSession(): Promise<void>;
}

export const nullTokenProvider: AuthTokenProvider = {
  async getAccessToken() {
    return null;
  },
  async refreshAccessToken() {
    return null;
  },
  async clearSession() {
  },
};
