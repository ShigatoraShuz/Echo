import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { JournalSupportJourney } from "./journal-support-journey";
import {
  beginSupportVisit,
  clearSupportJourney,
  completeSupportVisit,
  supportVisitToken,
  markSupportVisitArrived,
} from "../model/support-journey";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getSession: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/journal",
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/infrastructure/api/api-client", () => ({
  createApiClient: () => ({ get: mocks.get }),
}));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: mocks.getSession },
  }),
}));
vi.mock("@/config/environment", () => ({
  env: { apiBaseUrl: "http://localhost/api" },
}));
const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const state = {
  ownerId,
  eligible: true,
  recentJournalIds: [1, 2, 3].map(
    (n) => `00000000-0000-4000-8000-00000000000${n}`,
  ),
};
beforeEach(() => {
  vi.clearAllMocks();
  clearSupportJourney();
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: ownerId } } },
  });
  mocks.get.mockResolvedValue({ data: state });
});
it("requires a destination and cannot be dismissed with Escape, backdrop, close or reload", async () => {
  const { unmount } = render(<JournalSupportJourney />);
  const dialog = await screen.findByRole("dialog", { name: "Let’s make room for support" });
  expect(screen.getByRole("button", { name: /Talk to a professional/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /Try a grounding exercise/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Close dialog" })).toBeNull();
  expect(screen.queryByText("Stay with my journal for now")).toBeNull();
  await userEvent.setup().keyboard("{Escape}");
  await userEvent.setup().click(dialog.parentElement!);
  expect(dialog).toBeVisible();
  unmount(); render(<JournalSupportJourney />);
  await screen.findByRole("dialog", { name: "Let’s make room for support" });
  await userEvent.setup().click(screen.getByRole("button", { name: /Talk to a professional/ }));
  expect(mocks.push).toHaveBeenCalledWith("/professional-support");
});
it("requires readiness after the visit, including after a reload, without clearing server flags", async () => {
  await beginSupportVisit("grounding"); markSupportVisitArrived("grounding");
  completeSupportVisit("grounding", supportVisitToken("grounding"));
  const first = render(<JournalSupportJourney />);
  await screen.findByRole("dialog", { name: "A softer place to begin again" });
  expect(screen.getByText(/You made time for a grounding practice/)).toBeVisible();
  expect(screen.getByRole("button", { name: /I’m ready to write/ })).toBeDisabled();
  await userEvent.setup().keyboard("{Escape}"); expect(screen.getByRole("dialog")).toBeVisible();
  first.unmount();
  const second = render(<JournalSupportJourney />);
  await screen.findByRole("dialog", { name: "A softer place to begin again" });
  expect(screen.getByRole("button", { name: /I’m ready to write/ })).toBeDisabled();
  await userEvent.setup().click(screen.getByRole("checkbox", { name: /I feel ready to continue writing/ }));
  await userEvent.setup().click(screen.getByRole("button", { name: /I’m ready to write/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  second.unmount(); render(<JournalSupportJourney />); await act(async () => {});
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("does not mistake visiting professionals for a submitted request", async () => {
  await beginSupportVisit("professional"); markSupportVisitArrived("professional");
  render(<JournalSupportJourney />);
  await screen.findByRole("dialog");
  expect(screen.getByText(/You made space to explore support/)).toBeVisible();
  expect(screen.queryByText(/Your support request was submitted/)).toBeNull();
});
it("ignores late results after logout and a failed optional read never blocks the journal", async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { unmount } = render(
    <>
      <p>Journal remains available</p>
      <JournalSupportJourney />
    </>,
  );
  act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  await act(async () => finish({ data: state }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Journal remains available")).toBeVisible();
  unmount();
  mocks.get.mockRejectedValueOnce(Error("network unavailable"));
  render(
    <>
      <p>Journal remains available</p>
      <JournalSupportJourney />
    </>,
  );
  await act(async () => {});
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("rechecks once when a fresh model flag arrives during an older request", async () => {
  let finish!: (value: unknown) => void;
  mocks.get
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce({ data: state });
  render(<JournalSupportJourney />);
  act(() => {
    window.dispatchEvent(new Event("echo:safety-support"));
    window.dispatchEvent(new Event("echo:safety-support"));
  });
  await act(async () => finish({ data: { ...state, eligible: false } }));
  await screen.findByRole("dialog", { name: "Let’s make room for support" });
  expect(mocks.get).toHaveBeenCalledTimes(2);
});
