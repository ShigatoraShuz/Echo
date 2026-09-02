import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecureGoogleButton } from "./secure-google-button";
import type { GoogleIdentity } from "./google-identity";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  renderButton: vi.fn(),
  load: vi.fn(),
  prompt: vi.fn(),
  loginNonce: vi.fn(),
  signupNonce: vi.fn(),
  status: vi.fn(),
  bind: vi.fn(),
  signIn: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("./google-identity", () => ({ loadGoogleIdentity: () => mocks.load() }));
vi.mock("@/services/authentication/registration-api", () => ({
  registrationApi: {
    googleLoginNonce: (...args: unknown[]) => mocks.loginNonce(...args),
    googleNonce: (...args: unknown[]) => mocks.signupNonce(...args),
    googleLoginStatus: (...args: unknown[]) => mocks.status(...args),
    bindGoogle: (...args: unknown[]) => mocks.bind(...args),
  },
}));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { signInWithIdToken: mocks.signIn } }),
}));

async function ready() {
  await waitFor(() => expect(mocks.renderButton).toHaveBeenCalledTimes(1));
  return mocks.initialize.mock.calls[0][0] as Parameters<GoogleIdentity["initialize"]>[0];
}

describe("secure Google button flow", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-google-client");
    mocks.load.mockResolvedValue({
      initialize: mocks.initialize,
      renderButton: mocks.renderButton,
      prompt: mocks.prompt,
    });
    mocks.loginNonce.mockResolvedValue({ nonce: "raw-challenge", hashedNonce: "hashed-challenge" });
    mocks.signupNonce.mockResolvedValue({ nonce: "raw-signup", hashedNonce: "hashed-signup" });
    mocks.status.mockResolvedValue({ status: "existing_google_identity" });
    mocks.bind.mockResolvedValue({ reservation: "test-reservation" });
    mocks.signIn.mockResolvedValue({ error: null });
  });

  it("returns a Google login to the requested internal page", async () => {
    render(<SecureGoogleButton intent="login" successPath="/journal?view=week" />);
    const config = await ready();

    await act(async () => {
      await config.callback({ credential: "google-token" });
    });

    expect(mocks.router.replace).toHaveBeenCalledWith("/journal?view=week");
  });

  it("does not accept an external post-login redirect", async () => {
    render(<SecureGoogleButton intent="login" successPath="https://evil.example" />);
    const config = await ready();

    await act(async () => {
      await config.callback({ credential: "google-token" });
    });

    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the actual Google popup button and verifies the account before establishing a session", async () => {
    render(
      <StrictMode>
        <SecureGoogleButton intent="login" />
      </StrictMode>,
    );
    const config = await ready();
    expect(mocks.loginNonce).toHaveBeenCalledTimes(1);
    expect(config).toMatchObject({
      nonce: "hashed-challenge",
      ux_mode: "popup",
      use_fedcm_for_button: false,
      auto_select: false,
    });
    expect(mocks.prompt).not.toHaveBeenCalled();
    await act(async () => {
      await config.callback({ credential: "google-token" });
    });
    expect(mocks.status).toHaveBeenCalledWith("google-token", "raw-challenge");
    expect(mocks.signIn).toHaveBeenCalledWith({ provider: "google", token: "google-token", nonce: "raw-challenge" });
    expect(mocks.status.mock.invocationCallOrder[0]).toBeLessThan(mocks.signIn.mock.invocationCallOrder[0]);
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard");
  });

  it.each(["password_account_requires_link", "no_existing_account"])(
    "does not bypass login restrictions for %s",
    async (status) => {
      mocks.status.mockResolvedValue({ status });
      render(<SecureGoogleButton intent="login" />);
      const config = await ready();
      await act(async () => {
        await config.callback({ credential: "google-token" });
      });
      expect(screen.getByRole("alert")).toBeVisible();
      expect(mocks.signIn).not.toHaveBeenCalled();
      expect(mocks.router.replace).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Retry Google sign-in" }));
      await waitFor(() => expect(mocks.loginNonce).toHaveBeenCalledTimes(2));
    },
  );

  it("binds a signup to its verified draft before establishing a session", async () => {
    render(<SecureGoogleButton intent="signup" />);
    const config = await ready();
    await act(async () => {
      await config.callback({ credential: "signup-token" });
    });
    expect(mocks.bind).toHaveBeenCalledWith("signup-token", "raw-signup");
    expect(mocks.bind.mock.invocationCallOrder[0]).toBeLessThan(mocks.signIn.mock.invocationCallOrder[0]);
    expect(mocks.router.replace).toHaveBeenCalledWith("/onboarding");
    expect(mocks.loginNonce).not.toHaveBeenCalled();
  });

  it("refuses a signup session when the backend rejects the draft", async () => {
    mocks.bind.mockRejectedValue(new Error("Complete the previous signup steps first."));
    render(<SecureGoogleButton intent="signup" />);
    const config = await ready();
    await act(async () => {
      await config.callback({ credential: "signup-token" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Complete the previous signup steps first.");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("ignores late popup callbacks after leaving the screen", async () => {
    const view = render(<SecureGoogleButton intent="login" />);
    const config = await ready();
    view.unmount();
    await act(async () => {
      await config.callback({ credential: "stale-token" });
    });
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("recovers from an unavailable backend without opening Google or leaving a stuck loading state", async () => {
    mocks.loginNonce.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<SecureGoogleButton intent="login" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Check that the backend is running");
    expect(mocks.initialize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry Google sign-in" }));
    await ready();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
