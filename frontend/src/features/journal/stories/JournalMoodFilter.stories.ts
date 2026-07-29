import type { Meta, StoryObj } from "@storybook/react";
import { JournalMoodFilter } from "../components/JournalMoodFilter";

const meta: Meta<typeof JournalMoodFilter> = {
  title: "Journal/JournalMoodFilter",
  component: JournalMoodFilter,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof JournalMoodFilter>;

export const Default: Story = {
  args: { selected: null, onChange: () => {} },
};

export const Filtered: Story = {
  args: { selected: "calm", onChange: () => {} },
};
