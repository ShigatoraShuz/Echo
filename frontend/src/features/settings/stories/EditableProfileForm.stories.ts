import type { Meta, StoryObj } from "@storybook/react";
import { EditableProfileForm } from "../components/EditableProfileForm";

const meta: Meta<typeof EditableProfileForm> = {
  title: "Settings/EditableProfileForm",
  component: EditableProfileForm,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EditableProfileForm>;

export const Default: Story = {
  args: { displayName: "Alex", timezone: "America/New_York", onSubmit: () => {} },
};
