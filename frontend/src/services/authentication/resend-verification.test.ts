import { beforeEach, describe, expect, it, vi } from "vitest";
import { resendVerificationEmail } from "./resend-verification";
const mocks = vi.hoisted(() => ({ resend: vi.fn() }));
vi.mock("@/infrastructure/supabase/browser-client", () => ({ createBrowserSupabaseClient: () => ({ auth: { resend: mocks.resend } }) }));
beforeEach(() => { vi.clearAllMocks(); });
describe("verification email recovery", () => {
  it("requests signup verification for the entered email with a local callback", async () => {
    mocks.resend.mockResolvedValue({ error: null });
    expect(await resendVerificationEmail(" Mira@Example.com ")).toMatchObject({ success: true });
    expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: "mira@example.com", options: { emailRedirectTo: `${window.location.origin}/callback?next=%2Fonboarding` } });
  });
  it("validates email without sending", async () => {
    expect(await resendVerificationEmail("bad-address")).toMatchObject({ success: false });
    expect(mocks.resend).not.toHaveBeenCalled();
  });
  it("reports provider rate limits instead of claiming an email was sent", async () => {
    mocks.resend.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    expect(await resendVerificationEmail("mira@example.com")).toMatchObject({ success: false, message: expect.stringContaining("wait a minute") });
  });
  it("handles network failure", async () => {
    mocks.resend.mockRejectedValue(new Error("offline"));
    expect(await resendVerificationEmail("mira@example.com")).toMatchObject({ success: false, message: expect.stringContaining("connection") });
  });
});
