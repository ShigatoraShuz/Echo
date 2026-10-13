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
});
