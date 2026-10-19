import { afterEach, describe, expect, it, vi } from "vitest";
import { registrationApi } from "./registration-api";

afterEach(() => vi.unstubAllGlobals());

describe("registration request recovery", () => {
  it("explains a provider or API rate limit even when the response is plain text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Too many requests", { status: 429 })));

    await expect(registrationApi.eligibility("1990-01-01"))
      .rejects.toThrow("Too many signup requests. Please wait before trying again.");
  });

  it("gives a safe retry message for a temporary service failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Service unavailable", { status: 503 })));

    await expect(registrationApi.resend())
      .rejects.toThrow("Registration is temporarily unavailable. Please try again later.");
  });

  it("explains a lost connection without exposing a browser fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    await expect(registrationApi.eligibility("1990-01-01"))
      .rejects.toThrow("Could not connect to ECHO. Check your connection and try again.");
  });

  it("preserves a meaningful validation response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { message: "Review all three documents before continuing." },
    }), { status: 400, headers: { "content-type": "application/json" } })));

    await expect(registrationApi.agreements({
      reviewedDocumentIds: [], termsAccepted: true, privacyAccepted: true,
      aiNoticeAccepted: true, optionalAiAnalysis: false,
    })).rejects.toThrow("Review all three documents before continuing.");
  });
});
