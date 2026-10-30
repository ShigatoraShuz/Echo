import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinishEmailConfirmationPage from "./page";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), setSession: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { setSession: mocks.setSession } }),
}));

describe("implicit email confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/callback/finish");
  });

  it("clears the token fragment and opens onboarding after a verified session", async () => {
    mocks.setSession.mockResolvedValue({ data: { session: { access_token: "token" }, user: { id: "user-1" } }, error: null });
    window.localStorage.setItem("echo.auth.session-persistence", "session");
    window.history.replaceState(null, "", "/callback/finish?next=%2Fonboarding#access_token=token&refresh_token=refresh");

    render(<StrictMode><FinishEmailConfirmationPage /></StrictMode>);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding"));
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: "token", refresh_token: "refresh" });
    expect(mocks.setSession).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    expect(window.localStorage.getItem("echo.auth.session-persistence")).toBeNull();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("does not navigate when Supabase rejects the confirmation tokens", async () => {
    mocks.setSession.mockResolvedValue({ data: { session: null, user: null }, error: new Error("expired") });
    window.history.replaceState(null, "", "/callback/finish#access_token=token&refresh_token=refresh");

    render(<FinishEmailConfirmationPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("confirmation link could not finish sign-in");
    expect(window.location.hash).toBe("");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("does not claim success when a confirmation link has no session", async () => {
    render(<FinishEmailConfirmationPage />);

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
});
