import { afterEach, describe, expect, it, vi } from "vitest";

import { createResilientFetch } from "../../src/infrastructure/supabase/resilient-fetch.js";

const silentLogger = { warn: () => undefined };

function okResponse(status = 200): Response {
  return new Response("ok", { status });
}

describe("createResilientFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the response immediately when the first attempt succeeds", async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const resilientFetch = createResilientFetch({ baseDelayMs: 1, logger: silentLogger });
    const response = await resilientFetch("https://supabase.test/rest/v1/items");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries idempotent requests that fail with a retryable status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const resilientFetch = createResilientFetch({ baseDelayMs: 1, logger: silentLogger });
    const response = await resilientFetch("https://supabase.test/rest/v1/items");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-idempotent methods", async () => {
    const fetchMock = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const resilientFetch = createResilientFetch({ baseDelayMs: 1, logger: silentLogger });
    const response = await resilientFetch("https://supabase.test/rest/v1/rpc/run", {
      method: "POST",
    });

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the last response after exhausting all attempts", async () => {
    const fetchMock = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    const resilientFetch = createResilientFetch({ baseDelayMs: 1, maxAttempts: 3, logger: silentLogger });
    const response = await resilientFetch("https://supabase.test/rest/v1/items");

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries network failures and surfaces the last error when all attempts fail", async () => {
    const failure = new Error("ECONNRESET");
    const fetchMock = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal("fetch", fetchMock);

    const resilientFetch = createResilientFetch({ baseDelayMs: 1, maxAttempts: 2, logger: silentLogger });

    await expect(resilientFetch("https://supabase.test/rest/v1/items")).rejects.toThrow("ECONNRESET");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers after a transient network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const resilientFetch = createResilientFetch({ baseDelayMs: 1, logger: silentLogger });
    const response = await resilientFetch("https://supabase.test/rest/v1/items");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry client errors", async () => {
    const fetchMock = vi.fn(async () => new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const resilientFetch = createResilientFetch({ baseDelayMs: 1, logger: silentLogger });
    const response = await resilientFetch("https://supabase.test/rest/v1/items");

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
