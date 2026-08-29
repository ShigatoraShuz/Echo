import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/infrastructure/api/api-client", () => ({
  createApiClient: () => ({ post: mocks.post }),
}));

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: { getAccessToken: vi.fn() },
}));

describe("assessmentService", () => {
  beforeEach(() => mocks.post.mockReset().mockResolvedValue({ success: true }));

  it.each([
    ["awful", 1],
    ["bad", 2],
    ["okay", 3],
    ["good", 4],
    ["great", 5],
  ] as const)("maps %s to the Assessment Service score %s", async (mood, moodScore) => {
    const { assessmentService } = await import("./assessment.service");
    await assessmentService.recordMood(mood);
    expect(mocks.post).toHaveBeenCalledWith("/moods", { moodScore });
  });

  it("uses the implemented PHQ-8 route and unwraps its result", async () => {
    const result = { score: 8, severity: "mild", disclaimer: "Not a diagnosis." };
    mocks.post.mockResolvedValueOnce({ success: true, data: result });
    const { assessmentService } = await import("./assessment.service");
    await expect(assessmentService.scorePhq8([1, 1, 1, 1, 1, 1, 1, 1])).resolves.toEqual(result);
    expect(mocks.post).toHaveBeenCalledWith("/assessments/phq8", { answers: [1, 1, 1, 1, 1, 1, 1, 1] });
  });
});
