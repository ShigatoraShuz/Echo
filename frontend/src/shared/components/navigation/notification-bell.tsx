"use client";

import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { notificationsService, type NotificationItem, type NotificationStatusFilter } from "@/services/notifications";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

function formatDate(value: string): string {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function notificationHref(item: NotificationItem): string | null {
  switch (item.resourceType) {
    case "identity_verification":
      return "/settings/verification";
    case "journal":
      return item.resourceId ? `/journal/${encodeURIComponent(item.resourceId)}` : "/journal";
    case "grounding":
      return "/tools/grounding";
    case "data_export_request":
      return "/settings/export";
    case "account_deletion_request":
      return "/settings/export";
    case "trusted_contact":
      return "/settings/trusted-contacts";
    case "professional_case":
      return item.resourceId ? `/professional-support/requests/${encodeURIComponent(item.resourceId)}` : "/professional-support";
    default:
      return null;
  }
}

export function NotificationBell() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationStatusFilter>("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useFocusTrap<HTMLElement>(open);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const loadRequest = useRef(0);
  const readInFlight = useRef(new Set<string>());

  const load = useCallback(async (status: NotificationStatusFilter) => {
    const request = ++loadRequest.current;
    setLoading(true);
    setError(null);
    try {
      const data = await notificationsService.list(status, 20);
      if (request === loadRequest.current) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? data.notifications.filter((item) => !item.readAt).length);
      }
    } catch {
      if (request === loadRequest.current) setError("Notifications could not be loaded.");
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void load("all");
  }, [load]);

  useEffect(() => {
    const refresh = () => void load(filter);
    window.addEventListener("echo:notifications-changed", refresh);
    return () => window.removeEventListener("echo:notifications-changed", refresh);
  }, [filter, load]);

  useEffect(() => {
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void load(filter); };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [filter, load]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open, dialogRef]);

  async function markRead(item: NotificationItem) {
    if (item.readAt || readInFlight.current.has(item.id)) return;
    readInFlight.current.add(item.id);
    try {
      const data = await notificationsService.markRead(item.id);
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((current) => filter === "unread"
        ? current.filter((existing) => existing.id !== item.id)
        : current.map((existing) => existing.id === item.id ? data.notification : existing));
    } catch {
      setError("Notification could not be marked as read.");
    } finally {
      readInFlight.current.delete(item.id);
    }
  }

  async function markAllRead() {
    setSaving(true);
    setError(null);
    try {
      const data = await notificationsService.markAllRead();
      setNotifications(filter === "unread" ? [] : data.notifications);
      setUnreadCount(0);
    } catch {
      setError("Notifications could not be marked as read.");
    } finally {
      setSaving(false);
    }
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-[#10231b]/45 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-modal-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[1.5rem] border border-border/70 bg-card text-foreground shadow-[0_28px_80px_rgba(16,35,27,0.28)] sm:rounded-[2rem]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/65 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Notification center</p>
            <h2 id="notification-modal-title" className="mt-1 text-xl font-bold tracking-[-0.03em]">Gentle updates</h2>
            <p className="mt-1 text-xs text-muted-foreground">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/70 text-muted-foreground hover:bg-secondary"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form className="flex flex-col gap-3 border-b border-border/65 bg-muted/20 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="text-xs font-bold text-muted-foreground">
            Show
            <select
              value={filter}
              onChange={(event) => {
                const next = event.target.value as NotificationStatusFilter;
                setFilter(next);
                void load(next);
              }}
              className="mt-1 block h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={saving || unreadCount === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Mark all read
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span>{error}</span>
              <button type="button" onClick={() => void load(filter)} className="min-h-10 rounded-full px-3 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive">
                Retry
              </button>
            </div>
          ) : null}
          {loading ? (
            <div className="grid min-h-40 place-items-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : error && notifications.length === 0 ? null : notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 px-5 py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-bold">No notifications here</p>
              <p className="mt-1 text-xs text-muted-foreground">Account, support, and verification updates will appear here when available.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notifications.map((item) => {
                const href = notificationHref(item);
                const content = (
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {item.type === "analysis_completed" && item.resourceLabel
                          ? `Analysis ready: “${item.resourceLabel}”`
                          : item.title}
                      </p>
                      {!item.readAt ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Unread</span> : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.message}</p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{formatDate(item.createdAt)}</p>
                  </div>
                );
                return (
                  <li key={item.id} className={`rounded-2xl border p-4 ${item.readAt ? "border-border/60 bg-background/65" : "border-primary/25 bg-primary/5"}`}>
                    {href ? (
                      <Link href={href} onClick={() => { setOpen(false); void markRead(item); }} className="flex items-start gap-3 outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
                        {content}
                        <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      </Link>
                    ) : (
                      <button type="button" onClick={() => void markRead(item)} className="flex w-full items-start gap-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(true);
          void load(filter);
        }}
        className="relative grid size-[44px] place-items-center rounded-full border border-border/70 bg-card text-muted-foreground outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-black leading-none text-white ring-2 ring-card">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
