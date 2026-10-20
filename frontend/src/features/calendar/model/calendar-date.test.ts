import { describe, expect, it } from "vitest";
import { getCalendarDays, toLocalDateKey } from "./calendar-date";

describe("calendar dates", () => {
  it("builds a six-week Monday-first grid across month boundaries", () => {
    const days = getCalendarDays(new Date(2026, 7, 1));
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(toLocalDateKey(days[0])).toBe("2026-07-27");
    expect(toLocalDateKey(days[41])).toBe("2026-09-06");
  });
});
