import { render } from "@/shared/test-utils/test-utils";
import { axe } from "jest-axe";
import { BuddyChatBubble } from "../components/buddy-chat-bubble";

describe("active Buddy conversation accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<BuddyChatBubble message={{ id: "1", conversationId: "conversation-1", role: "buddy", content: "I am here with you.", timestamp: "Now" }} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
