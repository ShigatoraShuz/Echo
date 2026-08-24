"use client";

import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { notificationsService, type NotificationItem, type NotificationStatusFilter } from "@/services/notifications";

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
    case "data_export_request":
      return "/settings/export";
    case "account_deletion_request":
      return "/settings/export";
    case "trusted_contact":
      return "/settings/trusted-contacts";
    default:
      return null;
  }
}

export function NotificationBell() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationStatusFilter>("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  const load = useCallback(async (status: NotificationStatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationsService.list(status, 20);
      setNotifications(data.notifications);
    } catch {
      setError("Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void load("all");
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    try {
      const data = await notificationsService.markRead(item.id);
      setNotifications((current) => current.map((existing) => existing.id === item.id ? data.notification : existing));
    } catch {
      setError("Notification could not be marked as read.");
    }
  }

  async function markAllRead() {
    setSaving(true);
    setError(null);
    try {
      const data = await notificationsService.markAllRead();
      setNotifications(filter === "unread" ? [] : data.notifications);
    } catch {
      setError("Notifications could not be marked as read.");
    } finally {
      setSaving(false);
    }
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-[#10231b]/45 px-4 py-6 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-modal-title"
        className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-border/70 bg-card text-foreground shadow-[0_28px_80px_rgba(16,35,27,0.28)]"
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

        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {error ? <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <div className="grid min-h-40 place-items-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 px-5 py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-bold">No notifications here</p>
              <p className="mt-1 text-xs text-muted-foreground">New account, reminder, and verification updates will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notifications.map((item) => {
                const href = notificationHref(item);
                const content = (
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{item.title}</p>
                      {!item.readAt ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Unread</span> : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.message}</p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{formatDate(item.createdAt)}</p>
                  </div>
                );
                return (
                  <li key={item.id} className={`rounded-2xl border p-4 ${item.readAt ? "border-border/60 bg-background/65" : "border-primary/25 bg-primary/5"}`}>
                    {href ? (
                      <Link href={href} onClick={() => void markRead(item)} className="flex items-start gap-3 outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
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
        type="button"
        onClick={() => {
          setOpen(true);
          void load(filter);
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]"
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
