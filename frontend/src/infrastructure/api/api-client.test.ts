import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApiClient } from "@/infrastructure/api/api-client";

function createMockHeaders(headers?: Record<string, string>): Headers {
  const h = new Headers();
  h.set("content-type", "application/json");
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      h.set(k, v);
    }
  }
  return h;
}

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: createMockHeaders(headers),
    json: () => {
      if (typeof body === "string") throw new Error("not json");
      return Promise.resolve(body);
    },
    text: () => Promise.resolve(bodyStr),
    blob: () => Promise.resolve(new Blob([bodyStr])),
  } as Response);
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new Error("unexpected fetch")));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createApiClient", () => {
  it("joins base URL with path", async () => {
    mockFetch(200, {});
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    await client.get("/api/test");
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/test", expect.anything());
  });

  it("handles trailing slash in base URL", async () => {
    mockFetch(200, {});
    const client = createApiClient({ baseUrl: "http://localhost:8000/" });
    await client.get("/api/test");
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/test", expect.anything());
  });

  it("excludes undefined query parameters", async () => {
    mockFetch(200, {});
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    const url = "http://localhost:8000/api/test?search=hello";
    await client.get("/api/test?search=hello");
    expect(fetch).toHaveBeenCalledWith(url, expect.anything());
  });

  it("sends GET request", async () => {
    mockFetch(200, { data: "ok" });
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    const result = await client.get<{ data: string }>("/api/test");
    expect(result.data).toBe("ok");
  });

  it("sends POST request with body", async () => {
    mockFetch(201, { id: "1" });
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    const result = await client.post<{ id: string }>("/api/test", { name: "test" });
    expect(result.id).toBe("1");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "test" }),
      })
    );
  });

  it("sends PATCH request", async () => {
    mockFetch(200, {});
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    await client.patch("/api/test/1", { name: "updated" });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("sends PUT request", async () => {
    mockFetch(200, {});
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    await client.put("/api/test/1", { name: "replaced" });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("sends DELETE request", async () => {
    mockFetch(200, {});
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    await client.delete("/api/test/1");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("handles 204 response", async () => {
    mockFetch(204, "");
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    const result = await client.delete("/api/test/1");
    expect(result).toBeUndefined();
  });

  it("throws AppError on invalid JSON response error", async () => {
    mockFetch(500, "not json", { "content-type": "application/json" });
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    await expect(client.get("/api/test")).rejects.toThrow();
  });

  it("throws on network error", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    await expect(client.get("/api/test")).rejects.toThrow();
  });

  it("supports abort via signal", async () => {
    const controller = new AbortController();
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    const promise = client.get("/api/test", { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow();
  });

  it("injects auth token when provided", async () => {
    mockFetch(200, {});
    const tokenProvider = {
      getAccessToken: () => Promise.resolve("test-token"),
      refreshAccessToken: () => Promise.resolve(null),
      clearSession: () => Promise.resolve(),
    };
    const client = createApiClient({ baseUrl: "http://localhost:8000", tokenProvider });
    await client.get("/api/test");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("refreshes once and retries a 401 with the renewed token", async () => {
    vi.restoreAllMocks();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: createMockHeaders(),
        json: () => Promise.resolve({ error: { message: "expired" } }),
        text: () => Promise.resolve(JSON.stringify({ error: { message: "expired" } })),
        blob: () => Promise.resolve(new Blob()),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(),
        json: () => Promise.resolve({ ok: true }),
        text: () => Promise.resolve(JSON.stringify({ ok: true })),
        blob: () => Promise.resolve(new Blob()),
      } as Response);
    const tokenProvider = {
      getAccessToken: vi.fn(async () => "stale-token"),
      refreshAccessToken: vi.fn(async () => "fresh-token"),
      clearSession: vi.fn(async () => undefined),
    };
    const client = createApiClient({ baseUrl: "http://localhost:8000", tokenProvider });
    await expect(client.get("/api/test")).resolves.toEqual({ ok: true });
    expect(tokenProvider.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenProvider.clearSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer stale-token",
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
        }),
      })
    );
  });

  it("clears the session after an unrecoverable 401", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: createMockHeaders(),
      json: () => Promise.resolve({ error: { message: "expired" } }),
      text: () => Promise.resolve(JSON.stringify({ error: { message: "expired" } })),
      blob: () => Promise.resolve(new Blob()),
    } as Response);
    const tokenProvider = {
      getAccessToken: vi.fn(async () => null),
      refreshAccessToken: vi.fn(async () => null),
      clearSession: vi.fn(async () => undefined),
    };
    const client = createApiClient({ baseUrl: "http://localhost:8000", tokenProvider });
    await expect(client.get("/api/test")).rejects.toMatchObject({ code: "AUTHENTICATION_ERROR" });
    expect(tokenProvider.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenProvider.clearSession).toHaveBeenCalledTimes(1);
  });

  it("shares one refresh operation across concurrent 401 responses", async () => {
    vi.restoreAllMocks();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: createMockHeaders(),
        json: () => Promise.resolve({ error: { message: "expired" } }),
        text: () => Promise.resolve(JSON.stringify({ error: { message: "expired" } })),
        blob: () => Promise.resolve(new Blob()),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: createMockHeaders(),
        json: () => Promise.resolve({ error: { message: "expired" } }),
        text: () => Promise.resolve(JSON.stringify({ error: { message: "expired" } })),
        blob: () => Promise.resolve(new Blob()),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(),
        json: () => Promise.resolve({ ok: true, call: 1 }),
        text: () => Promise.resolve(JSON.stringify({ ok: true, call: 1 })),
        blob: () => Promise.resolve(new Blob()),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(),
        json: () => Promise.resolve({ ok: true, call: 2 }),
        text: () => Promise.resolve(JSON.stringify({ ok: true, call: 2 })),
        blob: () => Promise.resolve(new Blob()),
      } as Response);
    const tokenProvider = {
      getAccessToken: vi.fn(async () => "stale-token"),
      refreshAccessToken: vi.fn(async () => "fresh-token"),
      clearSession: vi.fn(async () => undefined),
    };
    const client = createApiClient({ baseUrl: "http://localhost:8000", tokenProvider });

    const [first, second] = await Promise.all([
      client.get<{ ok: true; call: number }>("/api/test"),
      client.get<{ ok: true; call: number }>("/api/test"),
    ]);

    expect(first).toEqual({ ok: true, call: 1 });
    expect(second).toEqual({ ok: true, call: 2 });
    expect(tokenProvider.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenProvider.clearSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not attach auth headers when no token is available", async () => {
    mockFetch(200, {});
    const tokenProvider = {
      getAccessToken: () => Promise.resolve(null),
      refreshAccessToken: () => Promise.resolve(null),
      clearSession: () => Promise.resolve(),
    };
    const client = createApiClient({ baseUrl: "http://localhost:8000", tokenProvider });
    await client.get("/api/public");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    );
  });

  it("does not log tokens in developer messages", async () => {
    mockFetch(500, { error: { message: "Server error" } });
    const client = createApiClient({ baseUrl: "http://localhost:8000" });
    try {
      await client.get("/api/test");
    } catch (err: unknown) {
      const appErr = err as { userMessage?: string; developerMessage?: string; headers?: Record<string, string> };
      expect(appErr.userMessage).toBe("Server error");
    }
  });

  describe("envelope contract parsing (ECHO-009)", () => {
    it("returns the canonical success envelope body for adapters to unwrap", async () => {
      mockFetch(200, { success: true, data: { id: "1" }, meta: { requestId: "req_1" } });
      const client = createApiClient({ baseUrl: "http://localhost:8000" });
      const result = await client.get<{ success: true; data: { id: string }; meta: { requestId: string } }>(
        "/api/test"
      );
      expect(result).toEqual({
        success: true,
        data: { id: "1" },
        meta: { requestId: "req_1" },
      });
    });

    it("accepts bare JSON bodies for non-envelope endpoints", async () => {
      mockFetch(200, { id: "1" });
      const client = createApiClient({ baseUrl: "http://localhost:8000" });
      const result = await client.get<{ id: string }>("/api/test");
      expect(result).toEqual({ id: "1" });
    });

    it("fails safely when a 2xx response carries success:false with an error", async () => {
      mockFetch(200, {
        success: false,
        error: { code: "AUTHENTICATION_REQUIRED", message: "Session required." },
        meta: { requestId: "req_2" },
      });
      const client = createApiClient({ baseUrl: "http://localhost:8000" });
      await expect(client.get("/api/test")).rejects.toMatchObject({
        code: "AUTHENTICATION_REQUIRED",
        userMessage: "Session required.",
      });
    });

    it("fails safely when a 2xx response carries success:false without an error", async () => {
      mockFetch(200, { success: false, meta: { requestId: "req_3" } });
      const client = createApiClient({ baseUrl: "http://localhost:8000" });
      await expect(client.get("/api/test")).rejects.toMatchObject({
        code: "CONTRACT_ERROR",
      });
    });

    it("fails safely when the success flag is a non-boolean value", async () => {
      mockFetch(200, { success: "yes", data: {} });
      const client = createApiClient({ baseUrl: "http://localhost:8000" });
      await expect(client.get("/api/test")).rejects.toMatchObject({
        code: "CONTRACT_ERROR",
      });
    });

    it("fails safely on malformed error bodies from non-2xx responses", async () => {
      mockFetch(500, { nonsense: true });
      const client = createApiClient({ baseUrl: "http://localhost:8000" });
      await expect(client.get("/api/test")).rejects.toMatchObject({
        code: "SERVER_ERROR",
      });
    });
  });
});
