import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleAuthButton } from "./google-auth-button";
import { signInWithGoogle } from "@/infrastructure/supabase/auth-helpers";

vi.mock("@/infrastructure/supabase/config", () => ({
  getSupabasePublicConfig: () => ({ url: "https://example.supabase.co", publishableKey: "pk" }),
}));

vi.mock("@/infrastructure/supabase/auth-helpers", () => ({
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
}));

describe("GoogleAuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signInWithGoogle).mockResolvedValue({ error: null, didRedirect: true });
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      configurable: true,
    });
  });

  it("sends signup users to onboarding and forces Google account selection", async () => {
    const user = userEvent.setup();
    render(<GoogleAuthButton intent="signup" />);

    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(signInWithGoogle).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", { name: /review terms and privacy notice/i });
    const termsCheckbox = within(dialog).getByRole("checkbox", { name: /i accept the terms of use/i });
    const privacyCheckbox = within(dialog).getByRole("checkbox", { name: /i have read the privacy notice/i });
    expect(termsCheckbox).toBeDisabled();
    expect(privacyCheckbox).toBeDisabled();

    const scrollArea = within(dialog).getByText(/purpose of echo/i).closest(".overflow-y-auto");
    if (!scrollArea) throw new Error("Terms scroll area was not found.");
    Object.defineProperties(scrollArea, {
      scrollTop: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
    });
    fireEvent.scroll(scrollArea);
    await user.click(termsCheckbox);

    await user.click(within(dialog).getByRole("button", { name: /privacy notice/i }));
    const privacyScrollArea = within(dialog).getByText(/information echo collects/i).closest(".overflow-y-auto");
    if (!privacyScrollArea) throw new Error("Privacy scroll area was not found.");
    Object.defineProperties(privacyScrollArea, {
      scrollTop: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
    });
    fireEvent.scroll(privacyScrollArea);
    await user.click(privacyCheckbox);

    await user.click(within(dialog).getAllByRole("button", { name: /continue with google/i }).at(-1)!);

    expect(signInWithGoogle).toHaveBeenCalledWith(
      "http://localhost:3000/callback?next=%2Fonboarding%2Fconsent&intent=signup",
      { forceAccountSelection: true },
    );
  });

  it("keeps login users on the requested safe destination and opens account selection", async () => {
    const user = userEvent.setup();
    render(<GoogleAuthButton intent="login" next="/journal" />);

    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    const dialog = screen.getByRole("dialog", { name: /review terms and privacy notice/i });

    const termsScrollArea = within(dialog).getByText(/purpose of echo/i).closest(".overflow-y-auto");
    if (!termsScrollArea) throw new Error("Terms scroll area was not found.");
    Object.defineProperties(termsScrollArea, {
      scrollTop: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
    });
    fireEvent.scroll(termsScrollArea);
    await user.click(within(dialog).getByRole("checkbox", { name: /i accept the terms of use/i }));

    await user.click(within(dialog).getByRole("button", { name: /privacy notice/i }));
    const privacyScrollArea = within(dialog).getByText(/information echo collects/i).closest(".overflow-y-auto");
    if (!privacyScrollArea) throw new Error("Privacy scroll area was not found.");
    Object.defineProperties(privacyScrollArea, {
      scrollTop: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
    });
    fireEvent.scroll(privacyScrollArea);
    await user.click(within(dialog).getByRole("checkbox", { name: /i have read the privacy notice/i }));
    await user.click(within(dialog).getAllByRole("button", { name: /continue with google/i }).at(-1)!);

    expect(signInWithGoogle).toHaveBeenCalledWith(
      "http://localhost:3000/callback?next=%2Fjournal&intent=login",
      { forceAccountSelection: true },
    );
  });
});
