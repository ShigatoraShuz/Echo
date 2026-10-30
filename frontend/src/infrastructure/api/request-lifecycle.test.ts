import { afterEach, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("releases completed request deadlines and external abort listeners", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } })));
  const controller = new AbortController();
  const removed = vi.spyOn(controller.signal, "removeEventListener");
  const client = createApiClient({ baseUrl: "http://127.0.0.1/__synthetic" });
  for (let i = 0; i < 100; i++) await client.get("/fixture", { signal: controller.signal });
  expect(vi.getTimerCount()).toBe(0);
  expect(removed).toHaveBeenCalledTimes(100);
});

it("does not retry a prior account's write after account invalidation during token refresh", async () => {
  let finish!: (token: string) => void;
  const refresh = new Promise<string>(resolve => { finish = resolve; });
  const tokenProvider = { getAccessToken: async () => "synthetic-account-a", refreshAccessToken: vi.fn(() => refresh), clearSession: vi.fn(async () => {}) };
  const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: "AUTHENTICATION_ERROR" } }), { status: 401, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const client = createApiClient({ baseUrl: "http://127.0.0.1/__synthetic", tokenProvider });
  const outcome = client.post("/journals", { body: "Fictional prior-account draft" }).catch(error => error);
  await vi.waitFor(() => expect(tokenProvider.refreshAccessToken).toHaveBeenCalledOnce());
  window.dispatchEvent(new Event("echo:sensitive-state-cleared"));
  finish("synthetic-account-b");
  await outcome;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(tokenProvider.clearSession).not.toHaveBeenCalled();
});

it("clears the expired session when a refreshed token is also rejected", async () => {
  const tokenProvider = { getAccessToken: async () => "synthetic-expired", refreshAccessToken: vi.fn(async () => "synthetic-revoked"), clearSession: vi.fn(async () => {}) };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "AUTHENTICATION_ERROR" } }), { status: 401, headers: { "content-type": "application/json" } })));
  const client = createApiClient({ baseUrl: "http://127.0.0.1/__synthetic", tokenProvider });
  await expect(client.get("/private")).rejects.toMatchObject({ statusCode: 401 });
  expect(tokenProvider.refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(tokenProvider.clearSession).toHaveBeenCalledTimes(1);
});
