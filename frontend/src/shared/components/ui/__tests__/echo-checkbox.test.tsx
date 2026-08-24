import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EchoCheckbox } from "../echo-checkbox";

describe("EchoCheckbox", () => {
  it("toggles when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<EchoCheckbox label="Accept terms" checked={false} onChange={onChange} />);

    await user.click(screen.getByLabelText("Accept terms"));
    expect(onChange).toHaveBeenCalled();
  });
});
