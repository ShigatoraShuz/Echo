import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { LoginExperience } from "./login-experience";
const mocks = vi.hoisted(() => ({ status: vi.fn(), replace: vi.fn(), refresh: vi.fn(), logout: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/services/assessment/assessment.service", () => ({ assessmentService: { status: mocks.status } }));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: () => ({ logout: mocks.logout }) }));
vi.mock("./phq8-check-in", () => ({
  Phq8CheckIn: ({ onCompleted }: { onCompleted: () => void }) => (
    <button onClick={onCompleted}>Finish saved check-in</button>
  ),
}));
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.status.mockResolvedValue({ due: true });
  mocks.logout.mockResolvedValue({ success: true });
});
it("waits for dashboard initialization and welcomes once per session", async () => {
  const view = render(<LoginExperience sessionKey="welcome-session" />);
  await waitFor(() => expect(mocks.status).toHaveBeenCalled());
  expect(screen.queryByRole("dialog", { name: "Welcome to your ECHO space" })).not.toBeInTheDocument();
  fireEvent(window, new Event("echo:dashboard-ready"));
  fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  expect(screen.getByText("Finish saved check-in")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Finish saved check-in"));
  expect(mocks.refresh).toHaveBeenCalled();
  fireEvent.click(screen.getByText("Not now"));
  mocks.status.mockResolvedValue({ due: false });
  view.unmount();
  render(<LoginExperience sessionKey="welcome-session" />);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("skips PHQ when not due after welcome", async () => {
  mocks.status.mockResolvedValue({ due: false });
  render(<LoginExperience sessionKey="not-due-session" />);
  fireEvent(window, new Event("echo:dashboard-ready"));
  fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  expect(screen.getByText("Not now")).toBeInTheDocument();
  expect(screen.queryByText("Finish saved check-in")).not.toBeInTheDocument();
});
it("keeps crisis and logout accessible when assessment status fails", async () => {
  mocks.status.mockRejectedValue(Error("unavailable"));
  render(<LoginExperience sessionKey="failed-session" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("assessment status is unavailable");
  expect(screen.getByRole("link", { name: "Crisis resources and emergency numbers" })).toHaveAttribute(
    "href",
    "/crisis",
  );
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
});
