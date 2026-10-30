import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleEmailMigration } from "./google-email-migration";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { getUser: mocks.getUser, updateUser: mocks.updateUser } }),
}));
vi.mock("@/infrastructure/supabase/config", () => ({
  requireSupabasePublicConfig: () => ({ url: "https://example.supabase.co", publishableKey: "public-key" }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: {
    signInWithPassword: mocks.signInWithPassword,
    signInWithOtp: mocks.signInWithOtp,
    verifyOtp: mocks.verifyOtp,
    signOut: mocks.signOut,
  } }),
}));

describe("Google email migration", () => {
  const account = { id: "existing-user", email: "user@example.com" };
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "existing-user", email: "user@example.com", identities: [{ provider: "google" }] } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "existing-user" }, session: { access_token: "password-session" } }, error: null });
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    mocks.verifyOtp.mockResolvedValue({ data: { user: { id: "existing-user" }, session: { access_token: "email-session" } }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("verifies both email methods against the original user ID", async () => {
    const user = userEvent.setup();
    render(<GoogleEmailMigration account={account} />);
    await user.type(screen.getByLabelText("New email password"), "StrongPass1");
    await user.type(screen.getByLabelText("Confirm email password"), "StrongPass1");
    await user.click(screen.getByRole("button", { name: "Set and verify password" }));
    await screen.findByText(/Password login works on your existing account/);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "StrongPass1" });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "StrongPass1" });

    await user.click(screen.getByRole("button", { name: "Send email code" }));
    await waitFor(() => expect(mocks.signInWithOtp).toHaveBeenCalledWith({ email: "user@example.com", options: { shouldCreateUser: false } }));
    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify email code" }));
    expect(await screen.findByText(/Password and email code both reached your original ECHO account/)).toBeInTheDocument();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "user@example.com", token: "123456", type: "email" });
  });

  it("does not complete migration when password login opens another user ID", async () => {
    const user = userEvent.setup();
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "different-user" }, session: { access_token: "wrong-session" } }, error: null });
    render(<GoogleEmailMigration account={account} />);
    await user.type(screen.getByLabelText("New email password"), "StrongPass1");
    await user.type(screen.getByLabelText("Confirm email password"), "StrongPass1");
    await user.click(screen.getByRole("button", { name: "Set and verify password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Keep Google sign-in available");
    expect(screen.queryByText(/Password login works/)).not.toBeInTheDocument();
  });

  it("does not complete migration when email code opens another user ID", async () => {
    const user = userEvent.setup();
    mocks.verifyOtp.mockResolvedValue({ data: { user: { id: "different-user" }, session: { access_token: "wrong-session" } }, error: null });
    render(<GoogleEmailMigration account={account} />);
    await user.type(screen.getByLabelText("New email password"), "StrongPass1");
    await user.type(screen.getByLabelText("Confirm email password"), "StrongPass1");
    await user.click(screen.getByRole("button", { name: "Set and verify password" }));
    await screen.findByText(/Password login works/);
    await user.click(screen.getByRole("button", { name: "Send email code" }));
    await screen.findByLabelText("Email code");
    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify email code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in must stay available");
    expect(screen.queryByText(/Password and email code both reached/)).not.toBeInTheDocument();
  });

});
