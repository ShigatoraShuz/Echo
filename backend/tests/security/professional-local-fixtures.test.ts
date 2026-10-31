import { describe, expect, it, vi } from "vitest";
import { assertFixtureUser, assertLocalDocker, assertLocalEndpoint, FIXTURE_TAG, localFetch } from "../../scripts/lib/professional-local-target.mts";

describe("local professional fixture boundaries", () => {
  it.each([
    "https://example.supabase.co", "http://localhost:54321", "http://127.0.0.1:4200",
    "https://127.0.0.1:54321", "http://127.0.0.1:54321@remote.invalid", "http://secret@127.0.0.1:54321",
  ])("refuses noncanonical/remote endpoint %s", (url) => {
    expect(() => assertLocalEndpoint(url)).toThrow();
  });
  it("allows the exact loopback API only", () => {
    expect(() => assertLocalEndpoint("http://127.0.0.1:54321/auth/v1/admin/users")).not.toThrow();
  });
  it("refuses remote Docker even if its containers use local project names", () => {
    expect(() => assertLocalDocker("ssh://remote")).toThrow();
    expect(() => assertLocalDocker("tcp://127.0.0.1:2375")).toThrow();
    expect(() => assertLocalDocker("npipe:////./pipe/dockerDesktopLinuxEngine")).not.toThrow();
  });
  it("never adopts an unmarked account or nonfixture address", () => {
    expect(() => assertFixtureUser({ email: "client@professional.echo.test", app_metadata: {} }, "client@professional.echo.test")).toThrow();
    expect(() => assertFixtureUser({ email: "real@example.com", app_metadata: { fixture: FIXTURE_TAG } }, "real@example.com")).toThrow();
    expect(() => assertFixtureUser({ email: "client@professional.echo.test", app_metadata: { fixture: FIXTURE_TAG } }, "client@professional.echo.test")).not.toThrow();
  });
  it("refuses HTTP redirects and never sends remote requests", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetch);
    try {
      expect(() => localFetch("https://remote.invalid")).toThrow();
      expect(fetch).not.toHaveBeenCalled();
      await localFetch("http://127.0.0.1:54321/rest/v1/", { redirect: "follow" });
      expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:54321/rest/v1/", expect.objectContaining({ redirect: "error" }));
    } finally { vi.unstubAllGlobals(); }
  });
});
