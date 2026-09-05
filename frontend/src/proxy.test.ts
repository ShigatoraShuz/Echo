import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/config", () => ({
  getSupabasePublicConfig: mocks.getConfig,
}));

vi.mock("@/infrastructure/supabase/middleware-client", () => ({
  createMiddlewareSupabaseClient: mocks.createClient,
}));

import { proxy } from "./proxy";

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe("authentication proxy", () => {
  beforeEach(() => {
    mocks.getConfig.mockReturnValue({ url: "https://example.supabase.co", publishableKey: "test-key" });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "test-access-token" } } });
    mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser, getSession: mocks.getSession } });
  });

  it.each([
    "/dashboard",
    "/journal/entry/new",
    "/buddy",
    "/insights/emotion",
    "/tools/grounding",
    "/settings/privacy",
    "/admin",
    "/onboarding",
    "/onboarding/age",
  ])("blocks signed-out access to %s", async (path) => {
    const response = await proxy(request(path));
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("login_required");
    expect(location.searchParams.get("next")).toBe(path);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("preserves a protected destination query without accepting an external redirect", async () => {
    const response = await proxy(request("/journal?view=week"));
    const location = new URL(response.headers.get("location")!);

    expect(location.searchParams.get("next")).toBe("/journal?view=week");
  });

  it.each(["/", "/login", "/signup", "/privacy", "/about"])("keeps public route %s available", async (path) => {
    const response = await proxy(request(path));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("fails closed on authenticated routes when Supabase configuration is missing", async () => {
    mocks.getConfig.mockReturnValue(null);

    const response = await proxy(request("/dashboard"));
    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_not_configured");
    expect(location.searchParams.get("next")).toBe("/dashboard");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("keeps the login page available when Supabase configuration is missing", async () => {
    mocks.getConfig.mockReturnValue(null);

    const response = await proxy(request("/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not serve the component preview in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await proxy(request("/design-system"))).status).toBe(404);
  });

  it("resolves a relative Gateway base URL against the incoming edge origin", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { decision: "ACCESS_GRANTED" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(request("/dashboard"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:3000/api/v1/access/status"),
      expect.objectContaining({ headers: { authorization: "Bearer test-access-token" }, cache: "no-store" }),
    );
  });
});
