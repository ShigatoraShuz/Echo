import { describe, expect, it } from "vitest";
import { messageBoundary, professionalMessageCursorSchema } from "../professional-message-cursor.js";

const at = "2026-10-21T00:00:00.123456+00:00";
const id = "fe000000-0000-4000-8000-000000000005";
describe("professional message boundaries", () => {
  it("preserves database microseconds and a deterministic UUID boundary", () => {
    expect(messageBoundary(at + "~" + id)).toEqual({ at, id });
  });
  it("retains timestamp-only cursor compatibility", () => {
    expect(messageBoundary(at)).toEqual({ at, id: undefined });
  });
  it.each(["", "not-a-date", at + "~", at + "~not-a-uuid", at + "~" + id + "~extra", at + ",id.gt.0", at + "~" + id + ")", "2026-02-30T00:00:00Z"]) ("rejects malformed/filter-injection cursor %s", (input) => {
    expect(professionalMessageCursorSchema.safeParse(input).success).toBe(false);
  });
});
