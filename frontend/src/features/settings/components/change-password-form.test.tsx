import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./change-password-form";

describe("ChangePasswordForm", () => {
  it("submits the current password and matching new password", async () => {
    const user = userEvent.setup();
    const onChangePassword = vi.fn().mockResolvedValue(undefined);
    render(<ChangePasswordForm onChangePassword={onChangePassword} isChanging={false} />);

    await user.type(screen.getByLabelText(/current password/i), "OldPassword1!");
    await user.type(screen.getByLabelText(/^new password/i), "NewPassword1!");
    await user.type(screen.getByLabelText(/confirm new password/i), "NewPassword1!");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(onChangePassword).toHaveBeenCalledWith("OldPassword1!", "NewPassword1!", "NewPassword1!");
    });
  });

  it("rejects mismatched new passwords before calling the backend", async () => {
    const user = userEvent.setup();
    const onChangePassword = vi.fn();
    render(<ChangePasswordForm onChangePassword={onChangePassword} isChanging={false} />);

    await user.type(screen.getByLabelText(/current password/i), "OldPassword1!");
    await user.type(screen.getByLabelText(/^new password/i), "NewPassword1!");
    await user.type(screen.getByLabelText(/confirm new password/i), "Different1!");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(onChangePassword).not.toHaveBeenCalled();
  });
});
