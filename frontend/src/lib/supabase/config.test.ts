import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicConfig } from "./config";

describe("getSupabasePublicConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when auth is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("returns only public Supabase configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");

    expect(getSupabasePublicConfig()).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "public-key",
    });
  });
});
