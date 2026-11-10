import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useJournalEditGuard } from "./use-journal-edit-guard";
afterEach(() => {
  window.dispatchEvent(new Event("echo:sensitive-state-cleared"));
  vi.restoreAllMocks();
});
it("warns before refresh and blocks navigation when discard is declined", () => {
  const view = renderHook(() => useJournalEditGuard("a", "v1", true, "title", "private unsaved text", vi.fn()));
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  const link = document.createElement("a");
  link.href = "/elsewhere";
  document.body.append(link);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    link.dispatchEvent(click);
  });
  expect(click.defaultPrevented).toBe(true);
  expect(view.result.current.pendingHref).toBe("/elsewhere");
  act(() => view.result.current.cancelNavigation());
  expect(view.result.current.pendingHref).toBeNull();
  link.remove();
  view.unmount();
});
it("recovers SPA edits for the same revision and clears them on account change", () => {
  const first = renderHook(() => useJournalEditGuard("b", "v1", true, "title", "private unsaved text", vi.fn()));
  first.unmount();
  const restore = vi.fn();
  const second = renderHook(() => useJournalEditGuard("b", "v1", false, "", "", restore));
  expect(restore).toHaveBeenCalledWith({ revision: "v1", title: "title", body: "private unsaved text" });
  second.unmount();
  act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  const cleared = vi.fn();
  renderHook(() => useJournalEditGuard("b", "v1", false, "", "", cleared));
  expect(cleared).not.toHaveBeenCalled();
});
it("does not restore an edit onto a changed revision", () => {
  const first = renderHook(() => useJournalEditGuard("c", "v1", true, "title", "body", vi.fn()));
  first.unmount();
  const restore = vi.fn();
  renderHook(() => useJournalEditGuard("c", "v2", false, "", "", restore));
  expect(restore).not.toHaveBeenCalled();
});
