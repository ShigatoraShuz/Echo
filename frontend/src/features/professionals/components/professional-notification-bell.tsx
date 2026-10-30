"use client";

import { useNotificationSound } from "@/shared/hooks/use-notification-sound";
import { professionalApi } from "@/services/professionals/professional-api";
import { forgetNotificationSource } from "@/services/notifications/notification-sound";
import { reportProfessionalAccessLoss } from "../professional-access-feedback";
import { useProfessionalRead, useProfessionalRefresh } from "../hooks/professional-read-scope";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Center = typeof import("./professional-notification-center").default;
// Executable code only. Never retain an actor, inbox or clinical data here.
let centerCode: Center | null = null;
let pendingCode: Promise<Center> | null = null;
function loadCenter() {
  return pendingCode ??= import("./professional-notification-center").then(module => {
    centerCode = module.default;
    return module.default;
  }).catch(reason => { pendingCode = null; throw reason; });
}

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
  const read = useProfessionalRead();
  const scope = actor + ":" + organizationId + ":" + role;
  const [noticeState, setNoticeState] = useState({ scope: "", unread: 0, exact: true, error: false });
  const unread = noticeState.scope === scope ? noticeState.unread : 0;
  const version = useRef(0);
  const stopped = useRef(false);
  const pending = useRef(new Map<string, ReturnType<typeof professionalApi.notifications>>());
  const dirty = useRef(false);
  const clinical = ["counselor", "psychologist", "social_worker"].includes(role);
  const discover = useCallback(async function discover(refresh = false): Promise<void> {
    if (!actor || !organizationId || !clinical || stopped.current) return;
    if (pending.current.has(scope) && refresh) { dirty.current = true; return; }
    const current = version.current;
    let noticeRead: ReturnType<typeof professionalApi.notifications> | undefined;
    try {
      noticeRead = pending.current.get(scope) ?? read("notifications:" + scope, () => professionalApi.notifications(organizationId), 1000);
      pending.current.set(scope, noticeRead);
      const page = await noticeRead;
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
      if (pending.current.get(scope) === noticeRead) pending.current.delete(scope);
      if (current === version.current && !stopped.current && dirty.current) {
        dirty.current = false;
        queueMicrotask(() => { void discover(); });
      }
    }
  }, [actor, organizationId, clinical, scope, observe, read]);
  useEffect(() => {
    stopped.current = false;
    version.current++;
    void discover();
    return () => {
      version.current++;
      forgetNotificationSource("professional:" + organizationId);
    };
  }, [discover, organizationId]);
  useProfessionalRefresh(
    () => void discover(true),
    clinical && actor ? actor + ":" + organizationId + ":" + role : "",
    () => {
      stopped.current = true;
      version.current++;
      setNoticeState({ scope: "", unread: 0, exact: true, error: false });
    },
    "notifications",
  );
  const [open, setOpen] = useState(false);
  const [NotificationCenter, setCenter] = useState<Center | null>(() => centerCode);
  const [codeError, setCodeError] = useState(false);
  const alive = useRef(true);
  const prepare = useCallback(() => {
    setCodeError(false);
    void loadCenter().then(component => { if (alive.current) setCenter(() => component); })
      .catch(() => { if (alive.current) setCodeError(true); });
  }, []);
  const trigger = useRef<HTMLButtonElement>(null);
  const anchor = useRef({ top: 88, right: 16 });
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);
  useEffect(() => {
    alive.current = true;
    const clear = () => setOpen(false);
    const hide = () => {
      if (document.visibilityState === "hidden") clear();
    };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    window.addEventListener("echo:professional-access-lost", clear);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("resize", clear);
    return () => {
      alive.current = false;
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
        onFocus={prepare}
        onPointerEnter={prepare}
        onClick={() => {
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) anchor.current = { top: rect.bottom + 12, right: Math.max(16, window.innerWidth - rect.right) };
          setOpen((value) => !value);
          if (!NotificationCenter) prepare();
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
      {open ? NotificationCenter ? (
        <NotificationCenter key={scope} anchor={anchor.current} organizationId={organizationId} userId={actor} role={role} onClose={close} />
      ) : (
        <div className="fixed inset-0 z-[400] bg-foreground/10" onClick={event => { if (event.target === event.currentTarget) close(); }}>
          <div role={codeError ? "alert" : "status"} className="pro-notification-panel p-6">
            {codeError ? <><p>Notifications couldn’t open.</p><button type="button" onClick={prepare} className="echo-focus-ring mt-3 min-h-11 text-sm font-semibold text-primary">Retry opening notifications</button></> : "Opening notifications…"}
          </div>
        </div>
      ) : null}
    </>
  );
}
