import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthSupabaseAdapter } from "@/services/authentication/auth.supabase-adapter";

const SESSION_PERSISTENCE_KEY = "echo.auth.session-persistence";

const VOLATILE_SESSION_MARKER_KEY = "echo.auth.volatile-session-active";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  updateProfile: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      getSession: mocks.getSession,
      updateUser: mocks.updateUser,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
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
    user_metadata: {
      display_name: "Mira",
    },
  },
  expires_at: 1_800_000_000,
  access_token: "token",
  refresh_token: "refresh",
};

function signInMock() {
  mocks.signInWithPassword.mockResolvedValue({
    data: {
      session,
    },
    error: null,
  });
}

describe("createAuthSupabaseAdapter logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();

    mocks.signOut.mockResolvedValue({
      error: null,
    });
  });

  it("ends the current browser session without revoking other devices", async () => {
    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.logout();

    expect(mocks.signOut).toHaveBeenCalledWith({
      scope: "local",
    });

    expect(result).toEqual({
      success: true,
      data: undefined,
    });
  });

  it("returns a safe service error when Supabase sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({
      error: {
        message: "Authentication could not be completed. Please try again.",
      },
    });

    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.logout();

    expect(result).toEqual({
      success: false,
      error: {
        code: "UNKNOWN",
        message: "Authentication could not be completed. Please try again.",
      },
    });
  });

  it("clears volatile session markers after logout", async () => {
    window.localStorage.setItem(SESSION_PERSISTENCE_KEY, "session");

    window.sessionStorage.setItem(VOLATILE_SESSION_MARKER_KEY, "active");

    const adapter = createAuthSupabaseAdapter();

    await adapter.logout();

    expect(window.localStorage.getItem(SESSION_PERSISTENCE_KEY)).toBeNull();

    expect(window.sessionStorage.getItem(VOLATILE_SESSION_MARKER_KEY)).toBeNull();
  });
});

describe("createAuthSupabaseAdapter session persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();

    mocks.signOut.mockResolvedValue({
      error: null,
    });

    signInMock();
  });

  it("keeps an unchecked remember-me login alive during a normal refresh", async () => {
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

    expect(window.localStorage.getItem(SESSION_PERSISTENCE_KEY)).toBe("session");

    expect(window.sessionStorage.getItem(VOLATILE_SESSION_MARKER_KEY)).toBe("active");

    window.dispatchEvent(new Event("beforeunload"));

    expect(mocks.signOut).not.toHaveBeenCalled();

    mocks.getSession.mockResolvedValue({
      data: {
        session,
      },
      error: null,
    });

    const refreshed = await adapter.getCurrentSession();

    expect(refreshed).toMatchObject({
      success: true,
      data: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("gives a retryable message when Supabase limits password attempts", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { status: 429, code: "over_request_rate_limit", message: "too many requests" },
    });

    const result = await createAuthSupabaseAdapter().login({
      email: "mira@test.com", password: "wrong-password", rememberSession: false,
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: "RATE_LIMITED", message: expect.stringMatching(/wait and try again later/i) },
    });
  });

  it("explains that a new email account must be confirmed before password login", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { status: 400, code: "email_not_confirmed", message: "Email not confirmed" },
    });
    const result = await createAuthSupabaseAdapter().login({
      email: "mira@test.com", password: "SecurePass1", rememberSession: false,
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: "EMAIL_NOT_CONFIRMED", message: "Verify your email address before logging in." },
    });
  });

  it("expires an unchecked remember-me login after the browser session marker is gone", async () => {
    const adapter = createAuthSupabaseAdapter();

    await adapter.login({
      email: "mira@test.com",
      password: "password123",
      rememberSession: false,
    });

    /*
     * sessionStorage is cleared when the browser/tab session ends.
     * localStorage still records that this was intentionally volatile.
     */
    window.sessionStorage.removeItem(VOLATILE_SESSION_MARKER_KEY);

    mocks.getSession.mockResolvedValue({
      data: {
        session,
      },
      error: null,
    });

    const result = await adapter.getCurrentSession();

    expect(mocks.signOut).toHaveBeenCalledWith({
      scope: "local",
    });

    expect(result).toEqual({
      success: true,
      data: null,
    });

    expect(window.localStorage.getItem(SESSION_PERSISTENCE_KEY)).toBeNull();
  });

  it("keeps remembered sessions persistent", async () => {
    const adapter = createAuthSupabaseAdapter();

    await adapter.login({
      email: "mira@test.com",
      password: "password123",
      rememberSession: true,
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session,
      },
      error: null,
    });

    const result = await adapter.getCurrentSession();

    expect(result).toMatchObject({
      success: true,
      data: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(mocks.signOut).not.toHaveBeenCalled();

    expect(window.localStorage.getItem(SESSION_PERSISTENCE_KEY)).toBeNull();
  });

  it("clears an old volatile marker when remember-me is checked", async () => {
    window.localStorage.setItem(SESSION_PERSISTENCE_KEY, "session");

    window.sessionStorage.setItem(VOLATILE_SESSION_MARKER_KEY, "active");

    const adapter = createAuthSupabaseAdapter();

    await adapter.login({
      email: "mira@test.com",
      password: "password123",
      rememberSession: true,
    });

    expect(window.localStorage.getItem(SESSION_PERSISTENCE_KEY)).toBeNull();

    expect(window.sessionStorage.getItem(VOLATILE_SESSION_MARKER_KEY)).toBeNull();
  });

  it("does not create volatile state when login fails", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        session: null,
      },
      error: {
        message: "invalid login credentials",
      },
    });

    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.login({
      email: "mira@test.com",
      password: "wrong",
      rememberSession: false,
    });

    expect(result.success).toBe(false);

    expect(window.localStorage.getItem(SESSION_PERSISTENCE_KEY)).toBeNull();

    expect(window.sessionStorage.getItem(VOLATILE_SESSION_MARKER_KEY)).toBeNull();

    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});

describe("createAuthSupabaseAdapter signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();

    Object.defineProperty(window, "location", {
      value: {
        origin: "http://localhost:3000",
      },
      configurable: true,
    });

    mocks.updateProfile.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: null,
      }),
    });
  });

  it("returns a pending email confirmation success when Supabase sends a confirmation email", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "mira@test.com",
        },
        session: null,
      },
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
        message: "If this address can register, a confirmation email will arrive. You can also sign in or request a password reset.",
      },
    });
  });

  it("returns the same confirmation response for duplicate signup", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "mira@test.com",
          identities: [],
        },
        session: null,
      },
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
      success: true,
      data: {
        requiresEmailConfirmation: true,
        email: "mira@test.com",
        message: "If this address can register, a confirmation email will arrive. You can also sign in or request a password reset.",
      },
    });
  });
});
