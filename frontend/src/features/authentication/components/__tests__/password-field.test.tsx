import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordField } from "../password-field";

describe("PasswordField", () => {
  it("toggles password visibility with the button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onToggleVisibility = vi.fn();

    render(
      <PasswordField
        label="Password"
        value="secret123"
        onChange={onChange}
        showPassword={false}
        onToggleVisibility={onToggleVisibility}
      />,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(onToggleVisibility).toHaveBeenCalledTimes(1);
  });
});
