import type { Meta, StoryObj } from "@storybook/react";
import { EmotionOverviewCard } from "../components/EmotionOverviewCard";

const meta: Meta<typeof EmotionOverviewCard> = {
  title: "Insights/EmotionOverviewCard",
  component: EmotionOverviewCard,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmotionOverviewCard>;

export const Default: Story = {
  args: { calmPercentage: 40, anxiousPercentage: 25, sadPercentage: 15, happyPercentage: 20 },
};
