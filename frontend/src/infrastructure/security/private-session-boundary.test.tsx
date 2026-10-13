import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateSessionBoundary } from "./private-session-boundary";

const SESSION_ID = "40000000-0000-4000-8000-000000000001";
const token = `header.${btoa(JSON.stringify({ session_id: SESSION_ID }))}.signature`;
const session = { user: { id: "account-a" }, access_token: token };
const activityKey = `echo:auth:last-activity:${SESSION_ID}`;
const h = vi.hoisted(() => ({
  callback: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  unsubscribe: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  fail: false,
}));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => {
    if (h.fail) throw new Error("Unconfigured");
    return {
      auth: {
        getSession: h.getSession,
        signOut: h.signOut,
        onAuthStateChange: (callback: typeof h.callback) => {
          h.callback = callback;
          return { data: { subscription: { unsubscribe: h.unsubscribe } } };
        },
      },
    };
  },
}));
beforeEach(() => {
  h.fail = false;
  h.unsubscribe.mockClear();
  h.signOut.mockReset().mockResolvedValue({ error: null });
  h.getSession.mockReset().mockResolvedValue({ data: { session }, error: null });
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function mount() {
  return render(<PrivateSessionBoundary userId="account-a"><p>Private journal for A</p></PrivateSessionBoundary>);
}
describe("private account lifecycle boundary", () => {
  it("keeps the page mounted across token refresh and same-account events", async () => {
    mount();
    await screen.findByText("Private journal for A");
    for (const event of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"]) {
      act(() => h.callback?.(event, session));
      expect(screen.getByText("Private journal for A")).toBeVisible();
    }
  });
  it.each([null, { user: { id: "account-b" } }])(
    "removes the prior account's UI and cached drafts on identity changes",
    async (nextSession) => {
      const listener = vi.fn();
      window.addEventListener("echo:sensitive-state-cleared", listener);
      const view = mount();
      await screen.findByText("Private journal for A");
      localStorage.setItem("journal-draft", "sensitive");
      sessionStorage.setItem("echo:active-analysis", "sensitive");
      act(() => h.callback?.("SIGNED_IN", nextSession));
      expect(screen.queryByText("Private journal for A")).toBeNull();
      expect(view.container.firstElementChild).toHaveAttribute("hidden");
      expect(localStorage.getItem("journal-draft")).toBeNull();
      expect(sessionStorage.getItem("echo:active-analysis")).toBeNull();
      act(() => h.callback?.("TOKEN_REFRESHED", nextSession));
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener("echo:sensitive-state-cleared", listener);
    },
  );
  it("unmounts private content when API session invalidation clears state", async () => {
    mount();
    await screen.findByText("Private journal for A");
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    expect(screen.queryByText("Private journal for A")).toBeNull();
  });
  it("hides departing private pages and rejects restored browser snapshots", async () => {
    const view = mount();
    await screen.findByText("Private journal for A");
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(view.container.firstElementChild).toHaveAttribute("hidden");
    const restored = new Event("pageshow");
    Object.defineProperty(restored, "persisted", { value: true });
    act(() => window.dispatchEvent(restored));
    expect(screen.queryByText("Private journal for A")).toBeNull();
  });
  it("fails closed when the session observer cannot be configured", () => {
    h.fail = true;
    mount();
    expect(screen.queryByText("Private journal for A")).toBeNull();
  });
  it("removes observers when leaving the private layout", async () => {
    const view = mount();
    await screen.findByText("Private journal for A");
    view.unmount();
    expect(h.unsubscribe).toHaveBeenCalledOnce();
  });
  it("signs out and hides private content after 30 minutes without activity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const view = mount();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Private journal for A")).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60 * 1000); });
    expect(h.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(view.container.firstElementChild).toHaveAttribute("hidden");
    expect(localStorage.getItem(activityKey)).toBe("0");
  });
  it("does not let a click after the deadline revive an expired session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const view = mount();
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      vi.setSystemTime(new Date("2026-10-13T10:31:00Z"));
      window.dispatchEvent(new Event("pointerdown"));
      await Promise.resolve();
    });
    expect(h.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(view.container.firstElementChild).toHaveAttribute("hidden");
  });
  it("counts activity from another tab before signing out", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    mount();
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(25 * 60 * 1000); });
    localStorage.setItem(activityKey, String(Date.now()));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: activityKey, newValue: String(Date.now()) })));
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60 * 1000); });
    expect(h.signOut).not.toHaveBeenCalled();
    expect(screen.getByText("Private journal for A")).toBeVisible();
  });
  it("uses the prior activity timestamp after a refresh", async () => {
    localStorage.setItem(activityKey, String(Date.now() - 31 * 60 * 1000));
    mount();
    await waitFor(() => expect(h.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(screen.queryByText("Private journal for A")).toBeNull();
  });
});
