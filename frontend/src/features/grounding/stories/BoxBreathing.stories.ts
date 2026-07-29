import type { Meta, StoryObj } from "@storybook/react";
import { BoxBreathing } from "../components/BoxBreathing";

const meta: Meta<typeof BoxBreathing> = {
  title: "Grounding/BoxBreathing",
  component: BoxBreathing,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BoxBreathing>;

export const Default: Story = {
  args: { onComplete: () => {} },
};
