import { beforeEach, it, expect, vi } from "vitest";
import { GET } from "./route";
const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), signOut: vi.fn(), exchangeCodeForSession: vi.fn() }));
vi.mock("@/infrastructure/supabase/server-client", () => ({ createServerSupabaseClient: async () => ({ auth }) }));
beforeEach(() => {
  vi.resetAllMocks();
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
});
it("confirms a registration using Supabase then requires normal email sign-in", async () => {
  const response = await GET(new Request("https://echo.test/callback?token_hash=opaque-secret&type=email"));
  expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "opaque-secret", type: "email" });
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(response.headers.get("location")).toBe("https://echo.test/login?confirmed=1");
});
it.each(["expired", "invalid"])("fails closed for %s confirmation without leaking credentials", async (message) => {
  auth.verifyOtp.mockResolvedValue({ error: { message } });
  const response = await GET(new Request("https://echo.test/callback?token_hash=opaque-secret&type=email"));
  expect(response.headers.get("location")).toBe("https://echo.test/login?error=sign_in_session_expired");
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
});
it("preserves Google PKCE authentication without a second OTP", async () => {
  const response = await GET(new Request("https://echo.test/callback?code=oauth-code"));
  expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe("https://echo.test/dashboard");
});
it("rejects external redirect destinations", async () => {
  const response = await GET(new Request("https://echo.test/callback?code=oauth-code&next=https://attacker.test"));
  expect(response.headers.get("location")).toBe("https://echo.test/dashboard");
});
