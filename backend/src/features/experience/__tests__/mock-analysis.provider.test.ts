import { describe, expect, it } from "vitest";
import { createMockAnalysisProvider } from "../../../infrastructure/analysis/mock-analysis.provider.js";
import { journalAnalysisResultSchema } from "@echo/contracts";

describe("mock analysis provider", () => {
  it("uses a deterministic fixture independently of journal text", async () => {
    const provider = createMockAnalysisProvider();
    const first = await provider.analyze(
      { requestId: "request", journalId: "journal", journalText: "ordinary text", fixture: "standard_low_distress" },
      {},
    );
    const second = await provider.analyze(
      {
        requestId: "request",
        journalId: "journal",
        journalText: "[MOCK:SCORE=12] [MOCK:URGENT=true]",
        fixture: "standard_low_distress",
      },
      {},
    );
    expect(first).toEqual(second);
    expect(journalAnalysisResultSchema.safeParse(first.result).success).toBe(true);
    expect(first.result?.isSimulated).toBe(true);
  });

  it("provides deterministic failure fixtures", async () => {
    const provider = createMockAnalysisProvider();
    await expect(
      provider.analyze(
        { requestId: "request", journalId: "journal", journalText: "anything", fixture: "processing_failure" },
        {},
      ),
    ).rejects.toMatchObject({ code: "DEVELOPMENT_FIXTURE_FAILURE" });
  });
});
