"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { clearSensitiveBrowserState } from "./clear-sensitive-state";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 5_000;

function sessionIdFromToken(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { session_id?: unknown };
    return typeof decoded.session_id === "string" && /^[0-9a-f-]{36}$/i.test(decoded.session_id)
      ? decoded.session_id : null;
  } catch {
    return null;
  }
}

/** A full document navigation also discards the router cache and module-level private state. */
export function PrivateSessionBoundary({ userId, children }: { userId: string; children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let invalidated = false;
    let mounted = true;
    let activityKey: string | null = null;
    let lastActivity = Date.now();
    let lastWrite = 0;
    let idleTimer: number | undefined;
    let auth: ReturnType<typeof createBrowserSupabaseClient>["auth"] | undefined;
    const hide = () => {
      if (container.current) container.current.hidden = true;
      setBlocked(true);
    };
    const invalidate = (destination: string) => {
      if (invalidated) return;
      invalidated = true;
      hide();
      clearSensitiveBrowserState();
      window.location.replace(destination);
    };
    const expireIdle = () => {
      if (invalidated) return;
      invalidated = true;
      hide();
      try { if (activityKey) window.localStorage.setItem(activityKey, "0"); } catch { /* Storage may be unavailable. */ }
      const signOut = auth ? auth.signOut({ scope: "local" }) : Promise.resolve();
      void signOut.catch(() => undefined).finally(() => {
        if (!mounted) return;
        clearSensitiveBrowserState();
        window.location.replace("/login?error=idle_timeout");
      });
    };
    const checkIdle = () => {
      if (!activityKey || invalidated) return;
      try {
        const stored = window.localStorage.getItem(activityKey);
        if (stored === "0") { expireIdle(); return; }
        const timestamp = Number(stored);
        if (stored !== null && Number.isFinite(timestamp) && timestamp > lastActivity && timestamp <= Date.now()) {
          lastActivity = timestamp;
        }
      } catch { /* Continue with this tab's activity clock. */ }
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) { expireIdle(); return; }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(checkIdle, remaining);
    };
    const onActivity = () => {
      if (!activityKey || invalidated) return;
      checkIdle();
      if (invalidated) return;
      lastActivity = Date.now();
      if (lastActivity - lastWrite >= ACTIVITY_WRITE_INTERVAL_MS) {
        try { window.localStorage.setItem(activityKey, String(lastActivity)); } catch { /* Keep the local clock. */ }
        lastWrite = lastActivity;
      }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(checkIdle, IDLE_TIMEOUT_MS);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === activityKey) checkIdle();
    };
    const onVisibility = () => { if (!document.hidden) checkIdle(); };
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
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", checkIdle);
    document.addEventListener("visibilitychange", onVisibility);
    for (const event of ["pointerdown", "keydown", "touchstart", "wheel"] as const) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    let unsubscribe: (() => void) | undefined;
    try {
      auth = createBrowserSupabaseClient().auth;
      const { data } = auth.onAuthStateChange((_event, session) => {
        if (invalidated) return;
        const nextUser = session?.user?.id;
        if (nextUser !== userId) invalidate(nextUser ? "/dashboard" : "/login?error=session_changed");
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void auth.getSession().then(({ data: sessionData, error }) => {
        if (!mounted || invalidated) return;
        const session = sessionData.session;
        const sessionId = session?.user.id === userId ? sessionIdFromToken(session.access_token) : null;
        if (error || !sessionId) { invalidate("/login?error=auth_unavailable"); return; }
        activityKey = `echo:auth:last-activity:${sessionId}`;
        try {
          const stored = window.localStorage.getItem(activityKey);
          if (stored !== null) {
            const timestamp = Number(stored);
            lastActivity = Number.isFinite(timestamp) && timestamp <= Date.now() ? timestamp : 0;
          } else {
            window.localStorage.setItem(activityKey, String(lastActivity));
          }
        } catch { /* Fall back to this tab's clock. */ }
        checkIdle();
        if (!invalidated) setReady(true);
      }).catch(() => invalidate("/login?error=auth_unavailable"));
    } catch {
      invalidate("/login?error=auth_unavailable");
    }
    return () => {
      mounted = false;
      window.clearTimeout(idleTimer);
      unsubscribe?.();
      window.removeEventListener("echo:sensitive-state-cleared", cleared);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", checkIdle);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const event of ["pointerdown", "keydown", "touchstart", "wheel"] as const) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [userId]);
  return <div ref={container}>{blocked || !ready ? null : children}</div>;
}
