import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { ConversationList } from "../components/ConversationList";

const mockConversations = [
  { id: "1", title: "Test Chat", lastMessage: "Hello", updatedAt: new Date() },
];

describe("ConversationList accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<ConversationList conversations={mockConversations} onSelect={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
