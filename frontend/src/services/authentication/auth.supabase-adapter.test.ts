import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthSupabaseAdapter } from "@/services/authentication/auth.supabase-adapter";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
    },
    schema: () => ({
      from: () => ({
        update: mocks.updateProfile,
      }),
    }),
  }),
}));

const session = {
  user: {
    id: "user-1",
    email: "mira@test.com",
    user_metadata: { display_name: "Mira" },
  },
  expires_at: 1_800_000_000,
  access_token: "token",
  refresh_token: "refresh",
};

function signInMock() {
  mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
}

function fireBeforeUnload() {
  window.dispatchEvent(new Event("beforeunload"));
}

describe("createAuthSupabaseAdapter logout", () => {
  beforeEach(() => {
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("ends the current browser session without revoking other devices", async () => {
    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.logout();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({ success: true, data: undefined });
  });

  it("returns a safe service error when Supabase sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "network unavailable" } });
    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.logout();

    expect(result).toEqual({
      success: false,
      error: { code: "UNKNOWN", message: "network unavailable" },
    });
  });
});

describe("createAuthSupabaseAdapter volatile session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue({ error: null });
    signInMock();
  });

  afterEach(() => {
    // Early adapter instances may have left a beforeunload listener on
    // `window`; fire it once and reset so stale sign-outs cannot leak into
    // the next assertion.
    fireBeforeUnload();
    vi.clearAllMocks();
  });

  it("signs out the session when the tab closes after an unchecked remember-me login", async () => {
    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.login({
      email: "mira@test.com",
      password: "password123",
      rememberSession: false,
    });

    expect(result.success).toBe(true);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "mira@test.com",
      password: "password123",
    });
    expect(mocks.signOut).not.toHaveBeenCalled();

    fireBeforeUnload();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the session alive on tab close when remember-me is checked", async () => {
    const adapter = createAuthSupabaseAdapter();

    await adapter.login({
      email: "mira@test.com",
      password: "password123",
      rememberSession: true,
    });

    fireBeforeUnload();

    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("removes the beforeunload handler on logout", async () => {
    const adapter = createAuthSupabaseAdapter();

    await adapter.login({
      email: "mira@test.com",
      password: "password123",
      rememberSession: false,
    });
    mocks.signOut.mockClear();

    const logout = await adapter.logout();
    expect(logout.success).toBe(true);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });

    mocks.signOut.mockClear();
    fireBeforeUnload();

    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("does not register a volatile handler when login fails", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid login credentials" },
    });
    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.login({
      email: "mira@test.com",
      password: "wrong",
      rememberSession: false,
    });

    expect(result.success).toBe(false);
    fireBeforeUnload();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});

describe("createAuthSupabaseAdapter signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      configurable: true,
    });
    mocks.updateProfile.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("returns a pending email confirmation success when Supabase sends a confirmation email", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-1", email: "mira@test.com" }, session: null },
      error: null,
    });
    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.signup({
      name: "Mira",
      email: "mira@test.com",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      termsAccepted: true,
      privacyAcknowledged: true,
      dataProcessingAcknowledged: true,
      aiFeatureAcknowledged: true,
      journalAnalysisConsent: false,
    });

    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "mira@test.com",
        options: expect.objectContaining({
          emailRedirectTo: "http://localhost:3000/callback?next=%2Fonboarding%2Fconsent&intent=signup",
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      data: {
        requiresEmailConfirmation: true,
        email: "mira@test.com",
        message: "We sent a confirmation link to mira@test.com. Open that email to continue your signup.",
      },
    });
  });

  it("maps duplicate signup responses to an email field error", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "user-1", email: "mira@test.com", identities: [] }, session: null },
      error: null,
    });
    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.signup({
      name: "Mira",
      email: "mira@test.com",
      password: "StrongP@ss1",
      confirmPassword: "StrongP@ss1",
      termsAccepted: true,
      privacyAcknowledged: true,
      dataProcessingAcknowledged: true,
      aiFeatureAcknowledged: true,
      journalAnalysisConsent: false,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "EMAIL_IN_USE",
        message: "This email has already been used. Log in instead.",
        fieldErrors: { email: ["This email has already been used."] },
      },
    });
  });
});
