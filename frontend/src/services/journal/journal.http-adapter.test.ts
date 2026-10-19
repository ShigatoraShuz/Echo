import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

describe("journal HTTP pagination", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1"));
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("uses the backend total and page metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { entries: [], total: 110, page: 2, page_size: 10 },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const { createJournalHttpAdapter } = await import("./journal.http-adapter");
    const result = await createJournalHttpAdapter().listEntries({
      query: "focus", mood: "calm", dateFrom: null, dateTo: null, sort: "oldest",
    }, 2, 10);
    expect(result).toMatchObject({ success: true, data: { pagination: {
      page: 2, pageSize: 10, totalItems: 110, totalPages: 11,
    } } });
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/journals?page=2&pageSize=10&query=focus&mood=calm&sort=oldest",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer access-token" }) }),
    );
  });

  it("sends only accepted draft fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { id: "current", title: "Note", body: "A thought", mood: "calm", emotions: [], tags: [], privacy_status: "private", analysis_consent: false, updated_at: "2026-10-13T00:00:00Z" },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const { createJournalHttpAdapter } = await import("./journal.http-adapter");
    await createJournalHttpAdapter().saveDraft({
      id: "client-only", updatedAt: "2026-10-13T00:00:00Z", title: "Note", body: "A thought",
      mood: "calm", emotions: [], tags: [], privacyStatus: "private", analysisConsent: false,
    });
    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      title: "Note", body: "A thought", mood: "calm", emotions: [], tags: [],
      privacyStatus: "private", analysisConsent: false,
    });
  });

  it("keeps a confirmed journal save successful when the follow-up read fails", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { journalId: "saved-id", status: "saved" } }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { message: "Read unavailable" } }), { status: 503, headers: { "content-type": "application/json" } })));
    const { createJournalHttpAdapter } = await import("./journal.http-adapter");
    const result = await createJournalHttpAdapter().createEntry({
      title: "A moment", body: "A short reflection", mood: "calm", emotions: [], tags: [],
      privacyStatus: "private", analysisConsent: false,
    }, { idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    expect(result).toMatchObject({ success: true, data: { id: "saved-id", title: "A moment" } });
  });

  it("uploads draft photos as binary and keeps a failed upload retryable", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { message: "Storage unavailable" } }),
        { status: 503, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: "photo-id" } }),
        { status: 200, headers: { "content-type": "application/json" } })));
    const { createJournalHttpAdapter } = await import("./journal.http-adapter");
    const adapter = createJournalHttpAdapter();
    const file = new File(["photo"], "moment.png", { type: "image/png" });
    expect((await adapter.uploadDraftImage("photo-id", file)).success).toBe(false);
    expect((await adapter.uploadDraftImage("photo-id", file)).success).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/journals/draft/images/photo-id",
      expect.objectContaining({ method: "PUT", body: file, headers: expect.objectContaining({ "Content-Type": "image/png" }) }),
    );
  });
});
