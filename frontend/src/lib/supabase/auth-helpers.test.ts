import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabasePublicConfig: () => ({ url: "https://example.supabase.co", publishableKey: "pk" }),
}));

import { signInWithGoogle } from "./auth-helpers";

describe("signInWithGoogle", () => {
  const assign = vi.fn();
  const fakeLocation = {
    origin: "http://localhost:3000",
    assign,
  } as unknown as Location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: fakeLocation,
      configurable: true,
      writable: true,
    });
  });

  it("starts the Google OAuth flow with the supplied callback URL", async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/auth?state=xyz" },
      error: null,
    });

    const result = await signInWithGoogle("http://localhost:3000/callback?next=/dashboard");

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/callback?next=/dashboard" },
    });
    expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth?state=xyz");
    expect(result).toEqual({ error: null });
  });

  it("returns the provider error without navigating on failure", async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "" },
      error: { message: "provider unavailable" },
    });

    const result = await signInWithGoogle("http://localhost:3000/callback");

    expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(result).toEqual({ error: "provider unavailable" });
  });
});