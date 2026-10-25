"use client";

import { useNotificationSound } from "@/shared/hooks/use-notification-sound";
import { useWorkspaceRefresh } from "@/shared/hooks/use-workspace-refresh";
import { professionalApi } from "@/services/professionals/professional-api";
import { forgetNotificationSource } from "@/services/notifications/notification-sound";
import { reportProfessionalAccessLoss } from "../professional-access-feedback";
import { Bell } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

const NotificationCenter = lazy(() => import("./professional-notification-center"));

/** Lightweight scoped discovery stays active while the panel is closed. */
export function ProfessionalNotificationBell({
  organizationId,
  role,
  userId,
}: {
  organizationId: string;
  role: string;
  userId?: string;
}) {
  const { actor, observe } = useNotificationSound(userId);
  const scope = actor + ":" + organizationId + ":" + role;
  const [noticeState, setNoticeState] = useState({ scope: "", unread: 0, exact: true, error: false });
  const unread = noticeState.scope === scope ? noticeState.unread : 0;
  const version = useRef(0);
  const stopped = useRef(false);
  const pending = useRef(new Set<string>());
  const clinical = ["counselor", "psychologist", "social_worker"].includes(role);
  const discover = useCallback(async () => {
    if (!actor || !organizationId || !clinical || stopped.current || pending.current.has(scope)) return;
    const current = version.current;
    pending.current.add(scope);
    try {
      const page = await professionalApi.notifications(organizationId);
      if (current === version.current && !stopped.current) {
        setNoticeState({ scope, unread: page.unreadCount ?? page.items.filter((item) => !item.readAt).length,
          exact: page.unreadCount !== undefined || !page.hasMore, error: false });
        observe("professional:" + organizationId, page.items);
      }
    } catch (reason) {
      if (current === version.current) {
        setNoticeState({ scope, unread: 0, exact: false, error: true });
        const failure = reportProfessionalAccessLoss(reason);
        if (failure.conceal) stopped.current = true;
      }
    } finally {
      pending.current.delete(scope);
    }
  }, [actor, organizationId, clinical, scope, observe]);
  useEffect(() => {
    stopped.current = false;
    version.current++;
    void discover();
    return () => {
      version.current++;
      forgetNotificationSource("professional:" + organizationId);
    };
  }, [discover, organizationId]);
  useWorkspaceRefresh(
    () => void discover(),
    clinical && actor ? actor + ":" + organizationId + ":" + role : "",
    () => {
      stopped.current = true;
      version.current++;
      setNoticeState({ scope: "", unread: 0, exact: true, error: false });
    },
  );
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const anchor = useRef({ top: 88, right: 16 });
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);
  useEffect(() => {
    const clear = () => setOpen(false);
    const hide = () => {
      if (document.visibilityState === "hidden") clear();
    };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    window.addEventListener("echo:professional-access-lost", clear);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("echo:sensitive-state-cleared", clear);
      window.removeEventListener("echo:professional-access-lost", clear);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("resize", clear);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, close]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={noticeState.scope === scope && noticeState.error ? "Notifications, updates unavailable" : unread ? "Notifications, " + (noticeState.exact ? "" : "at least ") + unread + " unread" : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!organizationId || !actor}
        onClick={() => {
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) anchor.current = { top: rect.bottom + 12, right: Math.max(16, window.innerWidth - rect.right) };
          setOpen((value) => !value);
        }}
        className="echo-focus-ring relative grid size-11 shrink-0 place-items-center rounded-full border border-border/70 bg-card text-primary hover:bg-secondary disabled:opacity-50"
      >
        <Bell size={20} aria-hidden="true" />
        {unread ? (
          <span className="absolute right-0 top-0 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[400] bg-foreground/10" onClick={close}>
              <div role="status" className="pro-notification-panel p-6">
                Opening notifications…
              </div>
            </div>
          }
        >
          <NotificationCenter key={scope} anchor={anchor.current} organizationId={organizationId} role={role} onClose={close} />
        </Suspense>
      ) : null}
    </>
  );
}
