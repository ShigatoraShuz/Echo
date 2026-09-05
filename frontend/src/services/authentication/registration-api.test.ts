import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registrationApi } from "./registration-api";

vi.mock("@/config/environment", () => ({ env: { apiBaseUrl: "http://127.0.0.1:4200/api/v1" } }));

describe("registration cookie transport", () => {
  const fetchMock = vi.fn();
  const nonce = "synthetic-test-challenge";
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("confirms cookie receipt on the page origin before making Google sign-in available", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { nonce, hashedNonce: "hash" } }) });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ready: true } }) });
    await expect(registrationApi.googleLoginNonce()).resolves.toEqual({ nonce, hashedNonce: "hash" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:4200/api/v1/registration/google/login-nonce",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:4200/api/v1/registration/google/login-challenge",
      expect.objectContaining({ credentials: "include", body: JSON.stringify({ nonce }) }),
    );
  });

  it("does not return a usable challenge when the browser cannot return its cookie", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { nonce, hashedNonce: "hash" } }) });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "The Google sign-in cookie was not received." } }),
    });
    await expect(registrationApi.googleLoginNonce()).rejects.toThrow("cookie was not received");
  });

  it("keeps the configured API endpoint for production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    await registrationApi.policies();
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4200/api/v1/registration/policies", expect.any(Object));
  });
});
