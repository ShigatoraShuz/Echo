import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthFormField } from "../auth-form-field";

describe("AuthFormField", () => {
  it("updates the textbox value and shows the error message", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AuthFormField
        label="Email address"
        value=""
        onChange={onChange}
        placeholder="you@example.com"
        error="Email is required"
        required
      />,
    );

    const input = screen.getByLabelText(/Email address/i) as HTMLInputElement;
    await user.type(input, "mira@example.com");

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required");
  });
});
