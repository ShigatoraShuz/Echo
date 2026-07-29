import type { Meta, StoryObj } from "@storybook/react";
import { JournalSearch } from "../components/JournalSearch";

const meta: Meta<typeof JournalSearch> = {
  title: "Journal/JournalSearch",
  component: JournalSearch,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof JournalSearch>;

export const Default: Story = {
  args: { value: "", onChange: () => {} },
};

export const WithQuery: Story = {
  args: { value: "anxiety", onChange: () => {} },
};
