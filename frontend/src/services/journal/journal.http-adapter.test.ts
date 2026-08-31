import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

describe("journal analysis HTTP adapter", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1"));
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.unstubAllGlobals(); });

  it("starts analysis through the Gateway route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { id: "a1", entry_id: "e1", summary: "Support", perspective: "Not diagnosis", mood_insight: "Pause", risk_indication: "mild", is_demo_data: false, created_at: "2026-08-30T00:00:00Z" },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const { createJournalHttpAdapter } = await import("./journal.http-adapter");
    const result = await createJournalHttpAdapter().requestAnalysis("e1");
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith("http://api.example.test/api/v1/journals/e1/analyze", expect.objectContaining({ method: "POST" }));
  });

  it("preserves the controlled ML-unavailable message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false, error: { code: "ML_INFERENCE_UNAVAILABLE", message: "Validated model currently unavailable." } }), { status: 503, headers: { "content-type": "application/json" } })));
    const { createJournalHttpAdapter } = await import("./journal.http-adapter");
    const result = await createJournalHttpAdapter().requestAnalysis("e1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toBe("Validated model currently unavailable.");
  });
});
