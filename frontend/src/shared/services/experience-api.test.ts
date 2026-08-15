import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/services/supabase-auth-token-provider", () => ({
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

describe("experience API adapter envelope contract (ECHO-009)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("unwraps data from a canonical success envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: { conversationId: "c-1", messages: [] },
          meta: { requestId: "req_1" },
        }),
      ),
    );

    const { experienceApi } = await import("./experience-api");
    const session = await experienceApi.getBuddySession();

    expect(session).toEqual({ conversationId: "c-1", messages: [] });
  });

  it("throws a typed AppError when the server returns an error envelope on 2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: false,
          error: { code: "AUTHENTICATION_REQUIRED", message: "Session required." },
          meta: { requestId: "req_2" },
        }),
      ),
    );

    const { experienceApi } = await import("./experience-api");
    await expect(experienceApi.getBuddySession()).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      userMessage: "Session required.",
      statusCode: 200,
    });
  });

  it("fails safely when the envelope data is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ success: true, meta: { requestId: "req_3" } })),
    );

    const { experienceApi } = await import("./experience-api");
    const session = await experienceApi.getBuddySession();
    expect(session).toBeUndefined();
  });
});