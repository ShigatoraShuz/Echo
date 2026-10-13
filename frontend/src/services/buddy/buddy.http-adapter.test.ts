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

  it("reports a verification-required 403 as an access error", async () => {
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

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("VERIFICATION_REQUIRED");
  });

  it("reads the Buddy history preference after access is approved", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => input.endsWith("/verification")
      ? jsonResponse({ success: true, data: { canAccessAi: true, accessRequirement: null } })
      : jsonResponse({ success: true, data: { buddyHistoryEnabled: false } })));
    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().getAccessStatus();
    expect(result).toMatchObject({ success: true, data: { canAccessAi: true, buddyHistoryEnabled: false } });
  });

  it("loads the authenticated session and maps messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            conversationId: "conv-1",
            messages: [
              { id: "m1", role: "user", content: "Long day.", timestamp: "7:05 PM" },
              { id: "m2", role: "buddy", content: "I am here with you.", timestamp: "7:05 PM" },
            ],
          },
        }),
      ),
    );

    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().getConversation("conv-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages).toHaveLength(2);
      expect(result.data.messages[1]).toMatchObject({ role: "buddy", content: "I am here with you." });
    }
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/buddy/conversations/conv-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("requests a bounded history page and maps server pagination", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, data: {
      conversations: [{ id: "conv-2", title: "Calm evening", last_message_at: null, created_at: "2026-10-01" }],
      total: 31, page: 2, page_size: 20, pinsAvailable: false,
    } })));
    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().listConversations(2, 20);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conversations.map((conversation) => conversation.id)).toEqual(["conv-2"]);
      expect(result.data.pagination).toMatchObject({ page: 2, totalItems: 31, totalPages: 2 });
      expect(result.data.pagination.pinsAvailable).toBe(false);
    }
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/buddy/history?page=2&pageSize=20",
      expect.any(Object),
    );
    await createBuddyHttpAdapter().listConversations(2, 20, undefined, "calm");
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/buddy/history?page=2&pageSize=20&query=calm",
      expect.any(Object),
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
              conversationId: "conv-1",
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
    const result = await createBuddyHttpAdapter().sendMessage({ conversationId: "conv-1", content: "Hello" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.messages[1].content).toBe("Hello there.");
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/buddy/messages",
      expect.objectContaining({ body: JSON.stringify({ content: "Hello", conversationId: "conv-1" }) }),
    );
  });

  it("sends a temporary chat without a saved conversation id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, data: {
      conversationId: null, persisted: false, messages: [
        { id: "u", role: "user", content: "Hello", timestamp: "Now" },
        { id: "b", role: "buddy", content: "I hear you", timestamp: "Now" },
      ],
    } }, 201)));
    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().sendMessage({ content: "Hello" });
    expect(result).toMatchObject({ success: true, data: { conversationId: null, persisted: false } });
    expect(fetch).toHaveBeenCalledWith("http://api.example.test/api/v1/buddy/messages", expect.objectContaining({
      body: JSON.stringify({ content: "Hello" }),
    }));
  });

  it("persists a pinned conversation through the authenticated API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, data: { pinned_at: "2026-10-12T00:00:00Z" } })));
    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().pinConversation("conv-1", true);
    expect(result).toEqual({ success: true, data: "2026-10-12T00:00:00Z" });
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/buddy/conversations/conv-1/pin",
      expect.objectContaining({ body: JSON.stringify({ pinned: true }) }),
    );
  });

  it("creates a saved conversation through the authenticated API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, data: {
      id: "conv-new", title: "Buddy conversation", last_message_at: null, created_at: "2026-10-13T00:00:00Z",
    } }, 201)));
    const { createBuddyHttpAdapter } = await import("@/services/buddy/buddy.http-adapter");
    const result = await createBuddyHttpAdapter().createConversation();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe("conv-new");
    expect(fetch).toHaveBeenCalledWith("http://api.example.test/api/v1/buddy/conversations", expect.any(Object));
  });
});
