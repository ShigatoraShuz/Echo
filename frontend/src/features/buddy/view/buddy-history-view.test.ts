import { describe, expect, it } from "vitest";
import { conversationDateGroup } from "./buddy-history-view";

describe("Buddy history date groups", () => {
  const now = new Date(2026, 9, 13, 12);

  it("groups by local calendar days around midnight", () => {
    expect(conversationDateGroup(new Date(2026, 9, 13, 0, 1).toISOString(), now)).toBe("Today");
    expect(conversationDateGroup(new Date(2026, 9, 12, 23, 59).toISOString(), now)).toBe("Yesterday");
    expect(conversationDateGroup(new Date(2026, 9, 7, 9).toISOString(), now)).toBe("Previous 7 Days");
    expect(conversationDateGroup(new Date(2026, 9, 5, 9).toISOString(), now)).toBe("Older");
  });
});
