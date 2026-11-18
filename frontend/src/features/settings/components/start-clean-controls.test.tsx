import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi, beforeEach } from "vitest";
import { StartCleanControls } from "./start-clean-controls";
import { reauthenticateActivityReset, resetAccountActivity } from "@/services/settings/account-activity";
vi.mock("@/services/settings/account-activity", () => ({
  reauthenticateActivityReset: vi.fn(),
  resetAccountActivity: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("requires typed confirmation and password, and cancellation never deletes activity", async () => {
  const user = userEvent.setup();
  render(<StartCleanControls />);
  await user.click(screen.getByRole("button", { name: "Clear my activity" }));
  expect(screen.getByRole("button", { name: "Start clean" })).toBeDisabled();
  await user.type(screen.getByLabelText(/Type START CLEAN/), "START CLEAN");
  expect(screen.getByRole("button", { name: "Start clean" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(resetAccountActivity).not.toHaveBeenCalled();
});
it("does not request a reset when password verification fails", async () => {
  vi.mocked(reauthenticateActivityReset).mockRejectedValue(new Error("Password verification failed."));
  const user = userEvent.setup();
  render(<StartCleanControls />);
  await user.click(screen.getByRole("button", { name: "Clear my activity" }));
  await user.type(screen.getByLabelText(/Type START CLEAN/), "START CLEAN");
  await user.type(screen.getByLabelText("Confirm your current password"), "fictional-password");
  await user.click(screen.getByRole("button", { name: "Start clean" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Password verification failed.");
  expect(resetAccountActivity).not.toHaveBeenCalled();
});
it("reuses the request ID after interrupted cleanup", async () => {
  vi.mocked(reauthenticateActivityReset).mockResolvedValue("owner");
  vi.mocked(resetAccountActivity).mockRejectedValue(new Error("Retry cleanup."));
  const user = userEvent.setup();
  render(<StartCleanControls />);
  await user.click(screen.getByRole("button", { name: "Clear my activity" }));
  await user.type(screen.getByLabelText(/Type START CLEAN/), "START CLEAN");
  for (let attempt = 0; attempt < 2; attempt++) {
    await user.type(screen.getByLabelText("Confirm your current password"), "fictional-password");
    await user.click(screen.getByRole("button", { name: "Start clean" }));
    await waitFor(() => expect(resetAccountActivity).toHaveBeenCalledTimes(attempt + 1));
    await waitFor(() => expect(screen.getByLabelText("Confirm your current password")).toHaveValue(""));
  }
  expect(vi.mocked(resetAccountActivity).mock.calls[1][0]).toBe(vi.mocked(resetAccountActivity).mock.calls[0][0]);
});
