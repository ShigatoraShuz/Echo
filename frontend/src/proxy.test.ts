import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createClient: vi.fn(),
  getClaims: vi.fn(),
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
    mocks.getClaims.mockResolvedValue({ data: null });
    mocks.createClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
  });

  it.each(["production", "test"])("rejects the preview with HTTP 404 in %s without checking authentication", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    try {
      for (const path of ["/dev/professional-preview", "/dev/professional-preview/", "/dev/professional-preview/case/demo"]) {
        const response = await proxy(request(path));
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
      expect(mocks.createClient).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });

  it("allows the local development preview and rejects nonlocal development hosts", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const local = new NextRequest("http://localhost:3000/dev/professional-preview", { headers: { host: "localhost:3000" } });
      expect((await proxy(local)).status).toBe(200);
      const nonlocal = new NextRequest("http://localhost:3000/dev/professional-preview", { headers: { host: "echo.example" } });
      expect((await proxy(nonlocal)).status).toBe(404);
      expect(mocks.createClient).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });

  it.each([
    "/dashboard",
    "/journal/entry/new",
    "/calendar",
    "/buddy",
    "/insights/emotion",
    "/tools/grounding",
    "/settings/privacy",
    "/admin",
    "/admin/professionals",
    "/professional/request",
    "/professional/my-requests",
    "/professional",
    "/professional/requests",
    "/professional/my-cases",
    "/professional/calendar",
    "/professional/resources",
    "/professional-support/requests",
    "/professional/access",
    "/professional/cases/fe000000-0000-4000-8000-000000000001",
    "/onboarding",
    "/onboarding/age",
  ])("blocks signed-out access to %s", async (path) => {
    const response = await proxy(request(path));
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe(
      ["/professional", "/professional/access", "/professional/requests", "/professional/my-cases", "/professional/calendar", "/professional/resources", "/professional/settings"].includes(path) || path.startsWith("/professional/cases/")
        ? "/professional/login"
        : "/login",
    );
    expect(location.searchParams.get("error")).toBe("login_required");
    expect(location.searchParams.get("next")).toBe(path === "/professional/access" ? "/professional" : path);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("preserves a protected destination query without accepting an external redirect", async () => {
    const response = await proxy(request("/journal?view=week"));
    const location = new URL(response.headers.get("location")!);

    expect(location.searchParams.get("next")).toBe("/journal?view=week");
  });

  it("keeps a safe case deep link when an access check discovers a signed-out session", async () => {
    const casePath = "/professional/cases/fe000000-0000-4000-8000-000000000001";
    const response = await proxy(request(`/professional/access?next=${encodeURIComponent(casePath)}`));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/professional/login");
    expect(location.searchParams.get("next")).toBe(casePath);
  });

  it.each(["/", "/login", "/signup", "/professional/login", "/privacy", "/about"])("keeps public route %s available", async (path) => {
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
  it("passes the same unpredictable nonce policy to the renderer and browser", async () => {
    const first = request("/login");
    const response = await proxy(first);
    expect(first.headers.get("Content-Security-Policy")).toBe(response.headers.get("Content-Security-Policy"));
    expect(first.headers.get("Content-Security-Policy")).toContain(`'nonce-${first.headers.get("x-nonce")}'`);
    expect(first.headers.get("Content-Security-Policy")).toContain("https://accounts.google.com");
    const second = request("/login"); await proxy(second);
    expect(first.headers.get("x-nonce")).not.toBe(second.headers.get("x-nonce"));
  });

  it("allows private journal photos from the configured Supabase origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://journal.example.supabase.co");
    try {
      vi.resetModules();
      const { proxy: configuredProxy } = await import("./proxy");
      const policy = (await configuredProxy(request("/login"))).headers.get("content-security-policy");
      expect(policy).toMatch(/img-src[^;]*https:\/\/journal\.example\.supabase\.co/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows both local API hosts when registration cookies follow the page host", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:4200/api/v1");
    try {
      vi.resetModules();
      const { proxy: localProxy } = await import("./proxy");
      const response = await localProxy(request("/login"));
      const policy = response.headers.get("content-security-policy");
      expect(policy).toContain("http://127.0.0.1:4200");
      expect(policy).toContain("http://localhost:4200");

      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
      const { proxy: productionProxy } = await import("./proxy");
      const productionResponse = await productionProxy(request("/login"));
      expect(productionResponse.headers.get("content-security-policy")).not.toContain("http://localhost:4200");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
