"use client";

import Link from "next/link";
import { Bell, CalendarDays, Check, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { professionalApi, type ProfessionalNotificationPage } from "@/services/professionals/professional-api";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { reportProfessionalAccessLoss } from "../professional-access-feedback";
import { useWorkspaceRefresh } from "@/shared/hooks/use-workspace-refresh";

const labels = { case_updated: "Case updated", appointment_changed: "Appointment updated", follow_up: "Follow-up reminder", referral_updated: "Referral updated", case_message: "New case message" };
const summaries = { case_updated: "A case assigned to you has changed.", appointment_changed: "The schedule for an assigned case has changed.", follow_up: "There’s a follow-up update on an assigned case.", referral_updated: "A referral on an assigned case has changed.", case_message: "A new message is available in an assigned case." };
const categories = ["All", "Inbox", "Messages", "General", "Appointments"] as const;

export default function ProfessionalNotificationCenter({ organizationId, role, onClose, anchor }: { anchor: { top: number; right: number }; organizationId: string; role: string; onClose: () => void }) {
  const clinical = ["counselor", "psychologist", "social_worker"].includes(role);
  const [page, setPage] = useState<ProfessionalNotificationPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState("");
  const [filter, setFilter] = useState<typeof categories[number]>("All");
  const pending = useRef<{ scope: string; request: Promise<ProfessionalNotificationPage> } | null>(null);
  const stopped = useRef(false);
  const version = useRef(0);
  const mutation = useRef(false);
  const dialog = useFocusTrap<HTMLElement>(true);
  const titleId = useId();
  const load = useCallback(async () => {
    if (!clinical || !organizationId || stopped.current || mutation.current) return;
    const current = ++version.current;
    setBusy(true); setPage(null); setError("");
    try {
      if (pending.current?.scope !== organizationId) {
        const request = professionalApi.notifications(organizationId);
        pending.current = { scope: organizationId, request };
        void request.finally(() => { if (pending.current?.request === request) pending.current = null; }).catch(() => {});
      }
      const result = await pending.current.request;
      if (version.current === current) setPage(result);
    } catch (reason) {
      if (version.current === current) { setPage(null); setError(reportProfessionalAccessLoss(reason).message); }
    } finally { if (version.current === current) setBusy(false); }
  }, [clinical, organizationId]);
  useEffect(() => { stopped.current = false; void load(); return () => { version.current += 1; }; }, [load]);
  useWorkspaceRefresh(() => { void load(); }, clinical ? organizationId + ":" + role : "", () => {
    stopped.current = true; version.current++; setPage(null); onClose();
  });
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [dialog]);
  async function markRead(id: string) {
    if (mutation.current || !page?.items.some(item => item.id === id && !item.readAt)) return;
    mutation.current = true; setReading(id); setError("");
    const current = version.current;
    try {
      const result = await professionalApi.readNotification(organizationId, id);
      if (current !== version.current) return;
      if (result.id !== id || !result.readAt) throw new Error("Notification acknowledgement unavailable");
      setPage(value => value ? { ...value, unreadCount: value.unreadCount === undefined ? undefined : Math.max(0, value.unreadCount - 1), items: value.items.map(item => item.id === id ? { ...item, readAt: result.readAt } : item) } : null);
      window.dispatchEvent(new Event("echo:notifications-changed"));
    } catch (reason) { if (current === version.current) { setPage(null); setError(reportProfessionalAccessLoss(reason).message); } }
    finally { if (current === version.current) { mutation.current = false; setReading(""); } }
  }
  const unread = page?.unreadCount ?? page?.items.filter(item => !item.readAt).length ?? 0;
  const items = page?.items.filter(item => filter === "Inbox" ? !item.readAt : filter === "Appointments" ? item.kind === "appointment_changed" : filter === "Messages" ? item.kind === "case_message" : filter === "General" ? ["case_updated", "referral_updated", "follow_up"].includes(item.kind) : true) ?? [];
  return createPortal(<div className="fixed inset-0 z-[400] bg-foreground/10" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="pro-notification-panel" style={window.innerWidth >= 640 ? { top: anchor.top, right: anchor.right, maxHeight: "min(720px, calc(100dvh - " + (anchor.top + 16) + "px))" } : undefined} data-lenis-prevent>
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Your workspace</p><h2 id={titleId} className="mt-1 [font-family:var(--font-echo-display)] text-[22px]">Notifications</h2><p className="mt-1 text-xs text-muted-foreground">{page ? page.hasMore && page.unreadCount === undefined ? unread + " unread in this view" : unread + " unread" : "Updates from your active organization"}</p></div><button type="button" aria-label="Close notifications" onClick={onClose} className="echo-focus-ring grid size-11 shrink-0 place-items-center rounded-full text-primary hover:bg-secondary"><X size={20} /></button></header>
      <div role="group" aria-label="Notification categories" className="pro-notification-filters">{categories.map(category => <button className="echo-focus-ring" key={category} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div>
      {page?.inAppEnabled === false ? <p role="status" className="mx-5 rounded-xl bg-secondary/50 p-3 text-xs leading-5 text-muted-foreground">In-app notifications are off. Existing updates remain available. You can change this in Settings.</p> : null}
      <div className="pro-notification-scroll p-4">
        {!clinical ? <div className="rounded-2xl bg-secondary/50 p-5"><Bell className="mb-3 text-primary" size={24} /><h3 className="font-semibold">No administrative notification source yet</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Clinical updates are limited to assigned practitioners. Your role does not receive case or appointment notifications.</p></div> : busy ? <div role="status" aria-busy="true" className="space-y-3 py-2"><span className="sr-only">Loading notifications</span>{[1,2,3].map(item => <div key={item} className="h-24 rounded-2xl bg-secondary/60 motion-safe:animate-pulse" />)}</div> : error ? <div role="alert" className="p-3"><h3 className="font-semibold">Updates couldn’t be loaded</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p><button type="button" onClick={() => void load()} className="echo-focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-secondary"><RefreshCw size={16} />Retry notifications</button></div> : items.length ? <ul className="space-y-2">{items.map(item => <li key={item.id} className={"rounded-2xl border border-border/60 p-4 " + (!item.readAt ? "bg-secondary/35" : "bg-background/40")}>
          <div className="flex items-start gap-3"><span className="mt-1 text-primary">{item.kind === "appointment_changed" ? <CalendarDays size={18} /> : <Bell size={18} />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{labels[item.kind] ?? "Workspace update"}</h3>{!item.readAt ? <span className="size-2 shrink-0 rounded-full bg-primary" role="img" aria-label="Unread" /> : null}</div><time dateTime={item.createdAt} className="mt-1 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time><p className="mt-2 text-xs leading-6 text-muted-foreground">{summaries[item.kind] ?? "An assigned-case update is available."}</p><div className="mt-2 flex flex-wrap items-center gap-2">{/^[0-9a-f-]{36}$/i.test(item.caseId) ? <Link prefetch={false} onNavigate={onClose} href={"/professional/cases/" + item.caseId + "?organization=" + encodeURIComponent(organizationId)} className="echo-focus-ring inline-flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-primary underline">Open case</Link> : null}{!item.readAt ? <button type="button" disabled={!!reading} onClick={() => void markRead(item.id)} className="echo-focus-ring inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50"><Check size={14} />{reading === item.id ? "Saving…" : "Mark read"}</button> : <span className="text-xs text-muted-foreground">Read</span>}</div></div></div>
        </li>)}</ul> : <div className="px-4 py-8 text-center"><Bell size={28} className="mx-auto mb-3 text-primary/65" /><h3 className="[font-family:var(--font-echo-display)] text-2xl">{filter === "Inbox" ? "You’re all caught up" : "No updates here yet"}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{filter === "Appointments" ? "Appointment changes for your assigned cases will appear here." : "New updates for your assigned cases will appear here."}</p></div>}
      </div>
      <footer className="border-t border-border/60 px-5 py-3 text-xs leading-5 text-muted-foreground">{page?.hasMore ? "Showing " + page.items.length + " of " + page.total + " updates. " : ""}Only your assigned cases in this organization. Opening an update rechecks access.<button type="button" disabled={busy || !!reading || !clinical} onClick={() => void load()} className="echo-focus-ring mt-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50"><RefreshCw size={14} />Refresh updates</button></footer>
    </section>
  </div>, document.body);
}
