import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalMoodSelector } from "../journal-mood-selector";

describe("JournalMoodSelector", () => {
  it("changes the selected mood when a mood button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<JournalMoodSelector value="calm" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /anxious/i }));
    expect(onChange).toHaveBeenCalledWith("anxious");
  });
});
