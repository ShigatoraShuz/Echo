import { describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/infrastructure/supabase/server-client", () => ({
  createServerSupabaseClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "./route";

describe("auth callback", () => {
  it("returns a completed login to a safe internal destination", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const response = await GET(new Request("http://localhost:3000/callback?code=one-time-code&next=%2Fjournal"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(response.headers.get("location")).toBe("http://localhost:3000/journal");
  });

  it("removes provider codes and query details from failed login redirects", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("expired") });

    const response = await GET(new Request("http://localhost:3000/callback?code=one-time-code&next=%2Fjournal&error_description=private"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=sign_in_session_expired");
  });
});
