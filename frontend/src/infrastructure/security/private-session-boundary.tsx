"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { clearSensitiveBrowserState } from "./clear-sensitive-state";

/** A full document navigation also discards the router cache and module-level private state. */
export function PrivateSessionBoundary({ userId, children }: { userId: string; children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let invalidated = false;
    const invalidate = (destination: string) => {
      if (invalidated) return;
      invalidated = true;
      // Hide synchronously, including while React batches the state change.
      if (container.current) container.current.hidden = true;
      setBlocked(true);
      clearSensitiveBrowserState();
      window.location.replace(destination);
    };
    const cleared = () => invalidate("/login?error=session_changed");
    const pageHide = () => {
      if (container.current) container.current.hidden = true;
    };
    const pageShow = (event: PageTransitionEvent) => {
      // A restored document can contain an old account's in-memory data.
      if (event.persisted) invalidate("/dashboard");
    };
    window.addEventListener("echo:sensitive-state-cleared", cleared);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", pageShow);
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createBrowserSupabaseClient().auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user?.id;
        if (nextUser !== userId) invalidate(nextUser ? "/dashboard" : "/login?error=session_changed");
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      invalidate("/login?error=auth_unavailable");
    }
    return () => {
      unsubscribe?.();
      window.removeEventListener("echo:sensitive-state-cleared", cleared);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
    };
  }, [userId]);
  return <div ref={container}>{blocked ? null : children}</div>;
}
