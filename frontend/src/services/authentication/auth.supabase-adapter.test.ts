import { beforeEach, describe, it, expect, vi } from "vitest";
import { createAuthSupabaseAdapter } from "./auth.supabase-adapter";
const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/browser-client", () => ({ createBrowserSupabaseClient: () => ({ auth }) }));
const input = { email: "person@example.com", code: "123456", password: "", rememberSession: true };
beforeEach(() => {
  vi.clearAllMocks();
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
describe("Supabase email OTP", () => {
  it("sends a code without creating an account or opening a password session", async () => {
    expect((await createAuthSupabaseAdapter().requestEmailCode(input.email)).success).toBe(true);
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: input.email, options: { shouldCreateUser: false } });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("establishes a session only through verified email OTP", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { session: { user: { id: "owner", email: input.email }, expires_at: 1800000000 } },
      error: null,
    });
    expect((await createAuthSupabaseAdapter().login(input)).success).toBe(true);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: input.email, token: input.code, type: "email" });
  });
  it.each([
    ["otp_expired", "Token has expired", "EXPIRED_TOKEN"],
    ["bad_code", "Invalid token", "INVALID_TOKEN"],
  ])("returns typed %s failures", async (code, message, expected) => {
    auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { code, message } });
    expect(await createAuthSupabaseAdapter().login(input)).toMatchObject({ success: false, error: { code: expected } });
  });
  it("rejects missing or malformed codes before provider access", async () => {
    expect((await createAuthSupabaseAdapter().login({ ...input, code: "12a" })).success).toBe(false);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("fails closed when a provider returns no session", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    expect((await createAuthSupabaseAdapter().login(input)).success).toBe(false);
  });
  it("ends only the current browser session", async () => {
    expect((await createAuthSupabaseAdapter().logout()).success).toBe(true);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("surfaces send and logout errors", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { message: "Rate limited" } });
    auth.signOut.mockResolvedValue({ error: { message: "Unavailable" } });
    expect((await createAuthSupabaseAdapter().requestEmailCode(input.email)).success).toBe(false);
    expect((await createAuthSupabaseAdapter().logout()).success).toBe(false);
  });
});
