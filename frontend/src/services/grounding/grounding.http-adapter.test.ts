import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

describe("grounding HTTP adapter", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("maps a completed session onto the authenticated grounding endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { id: "session-1", completedAt: "2026-08-17T10:00:00.000Z", completedSessions: 3 },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const { createGroundingHttpAdapter } = await import("@/services/grounding/grounding.http-adapter");
    const result = await createGroundingHttpAdapter().saveSession({
      type: "box-breathing",
      duration: 120,
      pace: "medium",
      completedAt: "2026-08-17T10:00:00.000Z",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        id: "session-1",
        type: "box-breathing",
        pace: "medium",
        progress: 100,
        state: "completed",
      });
    }
    const requestInit = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      technique: "box-breathing",
      durationSeconds: 120,
      pace: "slower",
    });
    expect(requestInit.headers).toEqual(expect.objectContaining({ Authorization: "Bearer access-token" }));
  });
});
