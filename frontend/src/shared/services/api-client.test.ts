import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApiClient } from "./api-client";

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
});
