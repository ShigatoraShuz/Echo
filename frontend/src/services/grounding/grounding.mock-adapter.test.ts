import { describe, expect, it } from "vitest";
import { createGroundingMockAdapter } from "./grounding.mock-adapter";

describe("grounding mock adapter", () => {
  it("returns one saved practice when the same completion is retried", async () => {
    const service = createGroundingMockAdapter();
    const input = {
      sessionId: crypto.randomUUID(),
      type: "box-breathing" as const,
      duration: 120,
      pace: "slow" as const,
      completedAt: "2026-10-18T00:00:00Z",
    };

    const first = await service.saveSession(input);
    const retry = await service.saveSession(input);
    const history = await service.getHistory(250);

    expect(first).toEqual(retry);
    expect(first.success).toBe(true);
    if (first.success && history.success) {
      expect(history.data.filter((item) => item.id === first.data.id)).toHaveLength(1);
    }
  });
});
