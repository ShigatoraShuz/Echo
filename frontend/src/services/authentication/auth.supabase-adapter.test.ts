import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthSupabaseAdapter } from "@/services/authentication/auth.supabase-adapter";

const SESSION_PERSISTENCE_KEY = "echo.auth.session-persistence";

const VOLATILE_SESSION_MARKER_KEY = "echo.auth.volatile-session-active";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
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
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
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

describe("email login codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();

    mocks.signOut.mockResolvedValue({
      error: null,
    });
  });

  it("uses Supabase OTP without creating unregistered accounts", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      error: null,
    });

    await createAuthSupabaseAdapter().sendLoginCode!("mira@test.com");

    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "mira@test.com",
      options: {
        shouldCreateUser: false,
      },
    });
  });

  it("requires a verified OTP session and explains expired codes", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: null,
      },
      error: {
        message: "expired",
      },
    });

    const adapter = createAuthSupabaseAdapter();

    expect(
      await adapter.verifyLoginCode!({
        email: "mira@test.com",
        code: "123456",
        rememberSession: true,
      }),
    ).toMatchObject({
      success: false,
      error: {
        message: expect.stringMatching(/invalid or has expired/),
      },
    });

    mocks.verifyOtp.mockResolvedValue({
      data: {
        session,
      },
      error: null,
    });

    expect(
      await adapter.verifyLoginCode!({
        email: "mira@test.com",
        code: "654321",
        rememberSession: true,
      }),
    ).toMatchObject({
      success: true,
      data: {
        user: {
          id: "user-1",
        },
      },
    });

    expect(mocks.verifyOtp).toHaveBeenLastCalledWith({
      email: "mira@test.com",
      token: "654321",
      type: "email",
    });
  });

  it("marks an unchecked OTP login as session-only", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session,
      },
      error: null,
    });

    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.verifyLoginCode!({
      email: "mira@test.com",
      code: "654321",
      rememberSession: false,
    });

    expect(result.success).toBe(true);

    expect(window.localStorage.getItem(SESSION_PERSISTENCE_KEY)).toBe("session");

    expect(window.sessionStorage.getItem(VOLATILE_SESSION_MARKER_KEY)).toBe("active");
  });
});

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
        message: "network unavailable",
      },
    });

    const adapter = createAuthSupabaseAdapter();

    const result = await adapter.logout();

    expect(result).toEqual({
      success: false,
      error: {
        code: "UNKNOWN",
        message: "network unavailable",
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
        message: "We sent a confirmation link to mira@test.com. Open that email to continue your signup.",
      },
    });
  });

  it("maps duplicate signup responses to an email field error", async () => {
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
      success: false,
      error: {
        code: "EMAIL_IN_USE",
        message: "This email has already been used. Log in instead.",
        fieldErrors: {
          email: ["This email has already been used."],
        },
      },
    });
  });
});
