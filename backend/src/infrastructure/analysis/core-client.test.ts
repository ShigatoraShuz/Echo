import { afterEach, describe, expect, it, vi } from "vitest";
import native from "../../../../packages/contracts/fixtures/core-v2.json";
import pipeline from "../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { CoreClient } from "./core-client.js";

const token = "synthetic-core-contract-token-32-characters";
afterEach(() => vi.unstubAllGlobals());

describe("native core HTTP ownership", () => {
  it("uses only the native route and contract, without redirects or caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(native)));
    vi.stubGlobal("fetch", fetcher);
    expect(await new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).toEqual(native);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:8000/v2/analyze", expect.objectContaining({
      redirect: "error", cache: "no-store", body: JSON.stringify({ text: "Fictional", language: "unknown" }),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }));
  });

  it.each([pipeline, { unexpected: "fictional-private-output" }])("rejects wrong contracts with a sanitized unavailable error", async (output) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(output))));
    const failure = new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional");
    await expect(failure).rejects.toMatchObject({ code: "AI_UNAVAILABLE", statusCode: 503, details: undefined });
    await expect(failure).rejects.not.toThrow("fictional-private-output");
  });

  it("does not fall back to engineering or a generated success when native is unavailable", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});


it("preserves the sanitized Talk-busy signal so Journal can wait without losing a valid job", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { code: "TALK_BUSY" } }), { status: 503 })));
  await expect(new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).rejects.toMatchObject({ code: "TALK_BUSY", statusCode: 503 });
});

it.each(["https://example.com", "http://127.0.0.1.example.com", "http://user:password@127.0.0.1:8000", "http://127.0.0.1:8000/other"]) ("rejects non-loopback origins and embedded credentials: %s", url => {
  expect(() => new CoreClient(url, token)).toThrow();
});
it("rejects oversized streamed model results without exposing them", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(1024 * 1024 + 1))));
  await expect(new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
});

it("does not transmit an oversized text payload", async () => {
  const fetcher=vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(new CoreClient("http://127.0.0.1:8000",token).analyze("x".repeat(65537))).rejects.toMatchObject({code:"AI_UNAVAILABLE"});
  expect(fetcher).not.toHaveBeenCalled();
});
