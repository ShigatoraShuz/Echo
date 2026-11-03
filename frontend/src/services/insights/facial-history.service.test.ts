import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFacialHistory } from "./facial-history.service";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

vi.mock("@/config/environment", () => ({ env: { apiBaseUrl: "https://example.invalid/api/v1" } }));
vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: { getAccessToken: vi.fn() },
}));

describe("facial history service", () => {
  beforeEach(() => vi.mocked(supabaseAuthTokenProvider.getAccessToken).mockResolvedValue("test-token"));
  afterEach(() => vi.unstubAllGlobals());

  it("loads account history without caching and validates each model result", async () => {
    const row = { journalId: "journal-1", result: {
      schemaVersion: "echo-face-expression-v1", status: "unavailable", reason: "model_unavailable",
    } };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [row] }) });
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(await getFacialHistory(signal)).toEqual([row]);
    expect(fetcher).toHaveBeenCalledWith("https://example.invalid/api/v1/journals/facial-history", {
      headers: { Authorization: "Bearer test-token" }, signal, cache: "no-store",
    });
  });

  it("rejects malformed model results instead of rendering them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
      { journalId: "journal-1", result: { status: "available", prediction: "trust" } },
    ] }) }));
    await expect(getFacialHistory(new AbortController().signal)).rejects.toThrow();
  });
});
