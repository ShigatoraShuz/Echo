import { describe, expect, it } from "vitest";
import { buddyDemoReply } from "../buddy-demo-replies.js";

describe("Buddy demo replies", () => {
  it.each([
    ["Help me untangle a thought", "more balanced view"],
    ["Guide a two-minute grounding", "five things you can see"],
    ["Reflect on today", "one moment from today"],
    ["Plan a gentle next step", "one small action"],
    ["I feel anxious", "another possible way"],
    ["I feel sad", "kinder, realistic way"],
    ["I am angry", "what response would support your goal"],
  ])("returns a labeled example for %s", (input, expected) => {
    const reply = buddyDemoReply(input, false);
    expect(reply).toContain("Demo reply (not AI-generated):");
    expect(reply).toContain(expected);
  });

  it("keeps the safety response ahead of demo prompts", () => {
    const reply = buddyDemoReply("Help me untangle a thought", true);
    expect(reply).toContain("Your immediate safety matters most");
    expect(reply).not.toContain("more balanced view");
  });

  it("uses a labeled generic example for other messages", () => {
    expect(buddyDemoReply("Hello Buddy", false)).toContain("Demo reply (not AI-generated): What happened");
  });
});
