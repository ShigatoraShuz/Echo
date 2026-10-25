"use client";
import Link from "next/link";
import { Bell, CalendarDays, CheckCheck, ChevronDown, ExternalLink, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { notificationsService, type NotificationItem } from "@/services/notifications";
import { useNotificationSound } from "@/shared/hooks/use-notification-sound";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { notificationAnchor, notificationHref, notificationQuery, notificationTabs, isAppointmentNotification, type NotificationTab } from "./notification-panel.model";
import "./notification-panel.css";

type Page = Awaited<ReturnType<typeof notificationsService.list>>;
function formatDate(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Unknown time";
}
export function NotificationBell() {
  const { actor, observe } = useNotificationSound();
  const observeRef = useRef(observe);
  useEffect(() => { observeRef.current = observe; }, [observe]);
  const [owner, setOwner] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("All");
  const tabRef = useRef<NotificationTab>("All");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const mutation = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState({ top: 88, right: 16 });
  const [instant, setInstant] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = owner === actor && !!actor;
  const dialog = useFocusTrap<HTMLElement>(open && active);
  const id = useId();
  const stopped = useRef(false);
  const epoch = useRef(0);
  const version = useRef(0);
  const pending = useRef(new Map<string, Promise<Page>>());
  const invalidate = useCallback(() => { epoch.current++; version.current++; }, []);
  const load = useCallback(async (next: NotificationTab, append = false) => {
    if (!actor || stopped.current || mutation.current) return;
    const before = append ? cursorRef.current : null;
    if (append && !before) return;
    const current = ++version.current, session = epoch.current;
    if (append) setMoreLoading(true); else { setLoading(true); setMoreLoading(false); }
    setError(null);
    const { status, category } = notificationQuery(next);
    const key = [actor, next, before].join(":");
    try {
      let request = pending.current.get(key);
      if (!request) {
        request = notificationsService.list(status, 20, { category, ...(before ? { before } : {}) });
        pending.current.set(key, request);
        const created = request;
        void request.finally(() => { if (pending.current.get(key) === created) pending.current.delete(key); }).catch(() => {});
      }
      const data = await request;
      if (stopped.current || session !== epoch.current || current !== version.current) return;
      // Category changes and older pages are browsing, never sound discovery.
      if (next === "All" && !append) observeRef.current("personal", data.notifications);
      setOwner(actor);
      setItems(previous => append ? [...new Map([...previous, ...data.notifications].map(item => [item.id, item])).values()] : data.notifications);
      setUnread(data.unreadCount ?? data.notifications.filter(item => !item.readAt).length);
      cursorRef.current = data.nextCursor ?? null; setCursor(cursorRef.current);
    } catch {
      if (session === epoch.current && current === version.current && !stopped.current) setError("Notifications could not be loaded. Please try again.");
    } finally {
      if (current === version.current && session === epoch.current) { setLoading(false); setMoreLoading(false); }
    }
  }, [actor]);
  useEffect(() => {
    epoch.current++; version.current++; stopped.current = !actor;
    pending.current.clear(); setOwner(actor); setItems([]); setUnread(0); setOpen(false); setError(null);
    setTab("All"); tabRef.current = "All"; cursorRef.current = null; setCursor(null);
    mutation.current = false; setSaving(false);
    if (actor) void load("All");
    return invalidate;
  }, [actor, load, invalidate]);
  useEffect(() => {
    let discoveryPending = false;
    const refresh = () => {
      if (stopped.current || !actor || document.visibilityState === "hidden" || mutation.current) return;
      void load(tabRef.current);
      if (tabRef.current !== "All" && !discoveryPending) {
        const session = epoch.current; discoveryPending = true;
        void notificationsService.list("all", 20).then(data => {
          if (!stopped.current && session === epoch.current) observeRef.current("personal", data.notifications);
        }).catch(() => {}).finally(() => { discoveryPending = false; });
      }
    };
    const clear = () => {
      stopped.current = true; epoch.current++; version.current++; pending.current.clear();
      setOwner(""); setItems([]); setUnread(0); setCursor(null); cursorRef.current = null; setOpen(false);
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("echo:notifications-changed", refresh);
    window.addEventListener("echo:sensitive-state-cleared", clear);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer); window.removeEventListener("echo:notifications-changed", refresh);
      window.removeEventListener("echo:sensitive-state-cleared", clear); window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [actor, load]);
  const position = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setAnchor(notificationAnchor(rect, window.innerWidth, window.innerHeight));
  }, []);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); } };
    document.addEventListener("keydown", escape); window.addEventListener("resize", position);
    const button = trigger.current;
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", escape); window.removeEventListener("resize", position); button?.focus(); };
  }, [open, dialog, position]);
  function selectTab(next: NotificationTab) {
    if (mutation.current || next === tabRef.current) return;
    tabRef.current = next; setTab(next); setItems([]); setCursor(null); cursorRef.current = null; void load(next);
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : -1;
    if (next < 0) return;
    event.preventDefault(); selectTab(notificationTabs[next]);
    dialog.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  async function markRead(item: NotificationItem) {
    if (item.readAt || mutation.current || stopped.current) return;
    mutation.current = true; setSaving(true); setError(null);
    const session = epoch.current;
    try {
      const data = await notificationsService.markRead(item.id);
      if (session !== epoch.current || stopped.current) return;
      if (data.notification.id !== item.id || !data.notification.readAt) throw new Error("Acknowledgement unavailable");
      version.current++; setLoading(false); setMoreLoading(false);
      setUnread(value => Math.max(0, value - 1));
      setItems(previous => tabRef.current === "Inbox" ? previous.filter(row => row.id !== item.id) : previous.map(row => row.id === item.id ? data.notification : row));
    } catch { if (session === epoch.current) setError("Notification could not be marked as read."); }
    finally { if (session === epoch.current) { mutation.current = false; setSaving(false); } }
  }
  async function markAllRead() {
    if (mutation.current || stopped.current) return;
    mutation.current = true; setSaving(true); setError(null);
    const session = epoch.current;
    try {
      const data = await notificationsService.markAllRead();
      if (session !== epoch.current || stopped.current) return;
      version.current++; setUnread(data.unreadCount ?? 0);
      setItems(previous => tabRef.current === "Inbox" ? [] : previous.map(row => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
      mutation.current = false; await load(tabRef.current);
    } catch { if (session === epoch.current) setError("Notifications could not be marked as read."); }
    finally { if (session === epoch.current) { mutation.current = false; setSaving(false); } }
  }
  const count = active ? unread : 0;
  const visibleItems = active ? items : [];
  const emptyTitle = tab === "Inbox" ? "You’re all caught up" : tab === "Appointments" ? "No appointment updates" : tab === "General" ? "No general updates" : "No notifications here";
  return <>
    <button ref={trigger} type="button" disabled={!actor} aria-label={`Notifications${count ? `, ${count} unread` : ""}`} aria-haspopup="dialog" aria-expanded={open && active} aria-controls={id + "-dialog"}
      onClick={event => { setInstant(event.detail === 0); position(); setOpen(value => !value); if (!open) void load(tabRef.current); }}
      className="relative grid size-[44px] place-items-center rounded-full border border-border/70 bg-card text-muted-foreground outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97] disabled:opacity-50">
      <Bell className="h-4 w-4" aria-hidden="true" />
      {count > 0 ? <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-black leading-none text-white ring-2 ring-card">{count > 9 ? "9+" : count}</span> : null}
    </button>
    {open && active ? createPortal(<div className="user-notification-backdrop" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialog} id={id + "-dialog"} role="dialog" aria-modal="true" aria-labelledby={id + "-title"} tabIndex={-1} className="user-notification-panel" data-instant={instant || undefined} data-lenis-prevent
        style={{ "--notification-top": anchor.top + "px", "--notification-right": anchor.right + "px" } as CSSProperties}>
        <header className="user-notification-heading"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-muted-foreground">Your workspace</p><h2 id={id + "-title"}>Notifications</h2><p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{count} unread notification{count === 1 ? "" : "s"}</p></div><button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="user-notification-icon"><X size={20} aria-hidden="true" /></button></header>
        <div role="tablist" aria-label="Notification categories" className="user-notification-tabs">{notificationTabs.map((category,index) => <button key={category} id={id + "-tab-" + category} role="tab" type="button" aria-selected={tab === category} aria-controls={id + "-list"} tabIndex={tab === category ? 0 : -1} disabled={saving} onClick={() => selectTab(category)} onKeyDown={event => tabKey(event,index)}>{category}</button>)}</div>
        <div className="user-notification-toolbar"><span className="text-xs text-muted-foreground">{tab === "Inbox" ? "Unread updates" : tab === "All" ? "Recent updates" : tab + " updates"}</span><button type="button" onClick={() => void markAllRead()} disabled={saving || !count} className="user-notification-action">{saving ? <LoaderCircle size={15} className="motion-safe:animate-spin" /> : <CheckCheck size={15} />}Mark all read</button></div>
        <div id={id + "-list"} role="tabpanel" aria-labelledby={id + "-tab-" + tab} aria-busy={loading} className="user-notification-list" tabIndex={0}>
          {error ? <div role="alert" className="mb-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-foreground"><p>{error}</p><button type="button" onClick={() => void load(tabRef.current)} className="user-notification-action"><RefreshCw size={15} />Retry</button></div> : null}
          {loading ? <div role="status" className="space-y-3"><span className="sr-only">Loading notifications</span>{[1,2,3].map(row => <div key={row} className="h-24 rounded-2xl bg-secondary/55 motion-safe:animate-pulse" />)}</div> : visibleItems.length ? <ul className="space-y-2">{visibleItems.map(item => {
            const href = notificationHref(item);
            const content = <><span className="mt-1 shrink-0 text-primary">{isAppointmentNotification(item.type) ? <CalendarDays size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-foreground">{item.type === "analysis_completed" && item.resourceLabel ? `Analysis ready: “${item.resourceLabel}”` : item.title}</p>{!item.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" role="img" aria-label="Unread" /> : null}</div><p className="mt-2 text-xs leading-6 text-muted-foreground">{item.message}</p><time dateTime={item.createdAt} className="mt-2 block text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</time></div>{href ? <ExternalLink size={14} className="mt-1 shrink-0 text-primary" aria-hidden="true" /> : null}</>;
            return <li key={item.id} className={"user-notification-item " + (!item.readAt ? "is-unread" : "")}>{href ? <Link href={href} prefetch={false} onClick={() => { setOpen(false); void markRead(item); }}>{content}</Link> : <button type="button" disabled={saving} onClick={() => void markRead(item)}>{content}</button>}</li>;
          })}</ul> : !error ? <div className="user-notification-empty"><Bell size={28} className="mx-auto mb-3 text-primary/65" aria-hidden="true" /><h3>{emptyTitle}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{tab === "Appointments" ? "Appointment proposals and schedule changes will appear here." : tab === "Inbox" ? "New unread updates will appear here." : "Account, journal, support and other updates will appear here."}</p></div> : null}
          {!loading && cursor ? <button type="button" disabled={moreLoading || saving} onClick={() => void load(tabRef.current, true)} className="user-notification-more">{moreLoading ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : <ChevronDown size={16} />}Load more updates</button> : null}
        </div>
        <footer className="user-notification-footer"><span>Updates for your account.</span><button type="button" aria-label="Refresh notifications" disabled={loading || saving} onClick={() => void load(tabRef.current)} className="user-notification-icon"><RefreshCw size={16} aria-hidden="true" /></button></footer>
      </section>
    </div>, document.body) : null}
  </>;
}
