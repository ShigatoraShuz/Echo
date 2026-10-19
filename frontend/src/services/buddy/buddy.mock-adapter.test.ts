import { afterEach, describe, expect, it, vi } from "vitest";
import { createBuddyMockAdapter } from "./buddy.mock-adapter";

describe("Buddy mock adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gives a user's message and Buddy's reply distinct IDs in the same millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const result = await createBuddyMockAdapter().sendMessage({ conversationId: "conv-1", content: "Hello" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages).toHaveLength(2);
      expect(result.data.messages[0].id).not.toBe(result.data.messages[1].id);
    }
  });
});
