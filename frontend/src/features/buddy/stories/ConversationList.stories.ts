import type { Meta, StoryObj } from "@storybook/react";
import { ConversationList } from "../components/ConversationList";

const meta: Meta<typeof ConversationList> = {
  title: "Buddy/ConversationList",
  component: ConversationList,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ConversationList>;

export const Default: Story = {
  args: {
    conversations: [
      { id: "1", title: "Morning Check-in", lastMessage: "How are you feeling today?", updatedAt: new Date() },
      { id: "2", title: "Evening Reflection", lastMessage: "Let's review your day", updatedAt: new Date(Date.now() - 86400000) },
    ],
    onSelect: () => {},
  },
};

export const Empty: Story = {
  args: {
    conversations: [],
    onSelect: () => {},
  },
};
