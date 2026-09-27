import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateSessionBoundary } from "./private-session-boundary";
const h = vi.hoisted(() => ({
  callback: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  unsubscribe: vi.fn(),
  fail: false,
}));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => {
    if (h.fail) throw new Error("Unconfigured");
    return {
      auth: {
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
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);
function mount() {
  return render(
    <PrivateSessionBoundary userId="account-a">
      <p>Private journal for A</p>
    </PrivateSessionBoundary>,
  );
}
describe("private account lifecycle boundary", () => {
  it("keeps the page mounted across token refresh and same-account events", () => {
    mount();
    for (const event of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"]) {
      act(() => h.callback?.(event, { user: { id: "account-a" } }));
      expect(screen.getByText("Private journal for A")).toBeVisible();
    }
  });
  it.each([null, { user: { id: "account-b" } }])(
    "removes the prior account's UI and cached drafts on identity changes",
    (session) => {
      const listener = vi.fn();
      window.addEventListener("echo:sensitive-state-cleared", listener);
      const view = mount();
      localStorage.setItem("journal-draft", "sensitive");
      sessionStorage.setItem("echo:active-analysis", "sensitive");
      act(() => h.callback?.("SIGNED_IN", session));
      expect(screen.queryByText("Private journal for A")).toBeNull();
      expect(view.container.firstElementChild).toHaveAttribute("hidden");
      expect(localStorage.getItem("journal-draft")).toBeNull();
      expect(sessionStorage.getItem("echo:active-analysis")).toBeNull();
      act(() => h.callback?.("TOKEN_REFRESHED", session));
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener("echo:sensitive-state-cleared", listener);
    },
  );
  it("unmounts private content when API session invalidation clears state", () => {
    mount();
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    expect(screen.queryByText("Private journal for A")).toBeNull();
  });
  it("hides departing private pages and rejects restored browser snapshots", () => {
    const view = mount();
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
  it("removes observers when leaving the private layout", () => {
    const view = mount();
    view.unmount();
    expect(h.unsubscribe).toHaveBeenCalledOnce();
  });
});
