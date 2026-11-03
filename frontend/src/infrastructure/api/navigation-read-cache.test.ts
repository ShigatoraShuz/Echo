import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client";
import { invalidateNavigationReads } from "./navigation-read-cache";
const response = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ success: true, data }),
  }) as Response;
const client = (token = "owner-a") =>
  createApiClient({
    baseUrl: "https://echo-test.invalid/api",
    tokenProvider: {
      getAccessToken: async () => token,
      refreshAccessToken: async () => null,
      clearSession: async () => {},
    },
  });
beforeEach(() => {
  invalidateNavigationReads();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response({ count: 1 })),
  );
});
afterEach(() => {
  invalidateNavigationReads();
  vi.unstubAllGlobals();
});
it("coalesces parallel opt-in reads, reuses them briefly and isolates returned objects", async () => {
  const api = client();
  const [first, second] = await Promise.all([
    api.get<{ data: { count: number } }>("/dashboard", { navigationCache: true }),
    api.get("/dashboard", { navigationCache: true }),
  ]);
  expect(fetch).toHaveBeenCalledTimes(1);
  first.data.count = 99;
  expect(second).toEqual({ success: true, data: { count: 1 } });
  expect(await api.get("/dashboard", { navigationCache: true })).toEqual(second);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("scopes reads to the exact session and expires entries after a minute", async () => {
  let now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  await client().get("/dashboard", { navigationCache: true });
  await client("owner-b").get("/dashboard", { navigationCache: true });
  expect(fetch).toHaveBeenCalledTimes(2);
  now += 60001;
  await client().get("/dashboard", { navigationCache: true });
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("never caches ordinary authorization reads or requests with caller abort signals", async () => {
  const api = client();
  await api.get("/access/status", { navigationCache: true });
  await api.get("/access/status", { navigationCache: true });
  const signal = new AbortController().signal;
  await api.get("/dashboard", { navigationCache: true, signal });
  await api.get("/dashboard", { navigationCache: true, signal });
  expect(fetch).toHaveBeenCalledTimes(4);
});
it.each([
  "echo:sensitive-state-cleared",
  "echo:privacy-changed",
  "echo:journal-changed",
  "echo:analysis-completed",
  "echo:appointments-changed",
  "focus",
])("clears cached displays on %s", async (event) => {
  const api = client();
  await api.get("/dashboard", { navigationCache: true });
  window.dispatchEvent(new Event(event));
  await api.get("/dashboard", { navigationCache: true });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("invalidates reads before and after mutations and never caches failed requests", async () => {
  const api = client();
  await api.get("/dashboard", { navigationCache: true });
  await api.post("/journals", { title: "Fictional" });
  await api.get("/dashboard", { navigationCache: true });
  expect(fetch).toHaveBeenCalledTimes(3);
  invalidateNavigationReads();
  vi.mocked(fetch).mockRejectedValueOnce(new Error("Fictional offline"));
  await expect(api.get("/dashboard", { navigationCache: true })).rejects.toBeDefined();
  await api.get("/dashboard", { navigationCache: true });
  expect(fetch).toHaveBeenCalledTimes(5);
});
it("drops a read whose token lookup finishes after logout", async () => {
  let resolve!: (token: string) => void;
  const token = new Promise<string>((done) => (resolve = done));
  const api = createApiClient({
    baseUrl: "https://echo-test.invalid",
    tokenProvider: { getAccessToken: () => token, refreshAccessToken: async () => null, clearSession: async () => {} },
  });
  const pending = api.get("/dashboard", { navigationCache: true });
  window.dispatchEvent(new Event("echo:sensitive-state-cleared"));
  resolve("old-owner");
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
});
