import type { Meta, StoryObj } from "@storybook/react";
import { TimerProgress } from "../components/TimerProgress";

const meta: Meta<typeof TimerProgress> = {
  title: "Grounding/TimerProgress",
  component: TimerProgress,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TimerProgress>;

export const Halfway: Story = {
  args: { elapsed: 60, total: 120 },
};

export const Complete: Story = {
  args: { elapsed: 120, total: 120 },
};
