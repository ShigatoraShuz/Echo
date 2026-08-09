import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { BuddyConversationList } from "../components/buddy-conversation-list";
import type { BuddyConversation } from "../model/buddy.model";

const mockConversations: BuddyConversation[] = [
  { id: "1", title: "Test Chat", lastMessage: "Hello", lastMessageAt: "Today", messageCount: 3, mood: "calm", createdAt: "2026-07-12" },
];

describe("BuddyConversationList accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<BuddyConversationList conversations={mockConversations} isLoading={false} onSelect={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});