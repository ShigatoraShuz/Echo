"use client";
import { useEffect, useRef, useState } from "react";

type Edit = { revision: string; title: string; body: string };
// SPA recovery only: no journal plaintext is written to browser storage.
const edits = new Map<string, Edit>();
if (typeof window !== "undefined") window.addEventListener("echo:sensitive-state-cleared", () => edits.clear());

export function useJournalEditGuard(
  id: string,
  revision: string | undefined,
  dirty: boolean,
  title: string,
  body: string,
  restore: (edit: Edit) => void,
) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const bypass = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  useEffect(() => {
    const saved = edits.get(id);
    if (saved && saved.revision === revision) restoreRef.current(saved);
  }, [id, revision]);
  useEffect(() => {
    if (dirty && revision) { bypass.current = false; edits.set(id, { revision, title, body }); }
  }, [id, revision, dirty, title, body]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (bypass.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const next = new URL(link.href, location.href);
      if (
        !["http:", "https:"].includes(next.protocol) ||
        (next.origin === location.origin && next.pathname === location.pathname && next.search === location.search)
      )
        return;
      if (bypass.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPendingHref(next.origin === location.origin ? next.pathname + next.search + next.hash : next.href);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [id, dirty]);
  return {
    forget: () => {
      edits.delete(id);
      bypass.current = true;
    },
    pendingHref,
    cancelNavigation: () => setPendingHref(null),
    discardNavigation: () => {
      const next = pendingHref;
      edits.delete(id);
      bypass.current = true;
      setPendingHref(null);
      return next;
    },
  };
}
