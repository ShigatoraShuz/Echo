import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
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
    mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
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
});
