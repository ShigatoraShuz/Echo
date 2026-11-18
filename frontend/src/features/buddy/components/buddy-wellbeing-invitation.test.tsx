import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { BuddyWellbeingInvitation } from "./buddy-wellbeing-invitation";
import { requestBuddyInvitation } from "@/services/settings/account-activity";
const state = vi.hoisted(() => ({ path: "/dashboard", actor: "owner" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/shared/hooks/use-notification-sound", () => ({ useNotificationSound: () => ({ actor: state.actor }) }));
vi.mock("@/services/settings/account-activity", () => ({ requestBuddyInvitation: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  state.path = "/dashboard";
  state.actor = "owner";
  vi.mocked(requestBuddyInvitation).mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("offers clear choices without opening a modal or stealing focus", async () => {
  render(<BuddyWellbeingInvitation />);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(screen.getByRole("region", { name: "A gentle invitation from Buddy" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Try grounding" })).toHaveAttribute("href", "/tools/grounding");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss Buddy invitation" }));
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it.each(["/journal/new", "/buddy", "/crisis", "/settings/profile"])("does not interrupt %s", async (path) => {
  state.path = path;
  render(<BuddyWellbeingInvitation />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(requestBuddyInvitation).not.toHaveBeenCalled();
});
it("does not show when the server denies eligibility, consent or cooldown", async () => {
  vi.mocked(requestBuddyInvitation).mockResolvedValue(false);
  render(<BuddyWellbeingInvitation />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it("hides the invitation when the account or route changes", async () => {
  const view = render(<BuddyWellbeingInvitation />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  state.actor = "other";
  view.rerender(<BuddyWellbeingInvitation />);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
