import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("buddy HTTP adapter", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports canAccessAi=false on a verification-required 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { success: false, error: { code: "VERIFICATION_REQUIRED", message: "Identity verification is required." } },
          403,
        ),
      ),
    );

    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().getAccessStatus();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.canAccessAi).toBe(false);
  });

  it("loads the selected authenticated conversation and maps messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            conversationId: "00000000-0000-4000-8000-000000000041",
            messages: [
              { id: "m1", role: "user", content: "Long day.", timestamp: "7:05 PM" },
              { id: "m2", role: "buddy", content: "I am here with you.", timestamp: "7:05 PM" },
            ],
          },
        }),
      ),
    );

    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().getConversation("00000000-0000-4000-8000-000000000041");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages).toHaveLength(2);
      expect(result.data.messages[1]).toMatchObject({ role: "buddy", content: "I am here with you." });
    }
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/buddy/conversations/00000000-0000-4000-8000-000000000041",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("returns the buddy reply as the sendMessage result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            success: true,
            data: {
              conversationId: "00000000-0000-4000-8000-000000000041",
              messages: [
                { id: "m1", role: "user", content: "Hello", timestamp: "7:05 PM" },
                { id: "m2", role: "buddy", content: "Hello there.", timestamp: "7:05 PM" },
              ],
            },
          },
          201,
        ),
      ),
    );

    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().sendMessage({ conversationId: "00000000-0000-4000-8000-000000000041", content: "Hello" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.content).toBe("Hello there.");
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/buddy/conversations/00000000-0000-4000-8000-000000000041/messages",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ content: "Hello" }) }),
    );
  });

});
