import { describe, expect, it } from "vitest";
import { createMockAnalysisProvider } from "../../src/infrastructure/analysis/mock-analysis.provider.js";

describe("mock analysis provider", () => {
  it("uses explicit development markers only", async () => {
    const provider = createMockAnalysisProvider();
    await expect(provider.analyze({ requestId: "request", journalText: "ordinary text", language: "en" })).resolves.toMatchObject({
      phq8Score: 0,
      severity: "minimal",
      provider: "mock",
    });
    await expect(provider.analyze({ requestId: "request", journalText: "[MOCK:SCORE=12] [MOCK:URGENT=true]", language: "en" })).resolves.toMatchObject({
      phq8Score: 12,
      severity: "moderate",
      urgentLanguageDetected: true,
    });
  });

  it("provides deterministic failure fixtures", async () => {
    const provider = createMockAnalysisProvider();
    await expect(provider.analyze({ requestId: "request", journalText: "[MOCK:FAIL]", language: "en" })).rejects.toMatchObject({ code: "MOCK_ANALYSIS_FAILED" });
  });
});
