"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, Bot, LockKeyhole, Pin, Search } from "lucide-react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import type { BuddyConversation } from "../model/buddy.model";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";

type DateGroup = "Today" | "Yesterday" | "Previous 7 Days" | "Older";

export function conversationDateGroup(value: string, now = new Date()): DateGroup {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Older";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day >= today) return "Today";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (day >= yesterday) return "Yesterday";
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
  return day >= week ? "Previous 7 Days" : "Older";
}

export function BuddyHistoryView() {
  const vm = useBuddyViewModel();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<{ kind: "rename" | "delete"; conversation: BuddyConversation } | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const searchConversations = vm.searchConversations;

  useEffect(() => {
    const timer = window.setTimeout(() => { void searchConversations(query); }, 250);
    return () => window.clearTimeout(timer);
  }, [query, searchConversations]);

  if (vm.accessStatus === "loading") return <div className="h-72 animate-pulse rounded-[2rem] bg-card/70" />;
  if (vm.accessStatus !== "allowed") {
    const needsContact = vm.accessStatus === "trusted_contact";
    const failed = vm.accessStatus === "error";
    return <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-8 text-center shadow-card">
      <LockKeyhole className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-5 font-serif text-3xl">{failed ? "Buddy access could not be checked" : needsContact ? "Add a trusted support contact" : "Verification is required"}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{failed ? vm.error ?? "Please try again shortly." : needsContact ? "Add a valid trusted contact with their permission to open Buddy history." : "Buddy history requires approved verification and a permitted trusted contact."}</p>
      <Link href={needsContact ? "/settings/trusted-contacts" : failed ? "/settings" : "/settings/verification"} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"><BadgeCheck className="h-4 w-4" />Open settings</Link>
    </div>;
  }

  const pinned = vm.conversations.filter((item) => item.pinnedAt);
  const unpinned = vm.conversations.filter((item) => !item.pinnedAt);
  const groups: Array<{ title: string; items: BuddyConversation[] }> = [
    { title: "Pinned", items: pinned },
    ...(["Today", "Yesterday", "Previous 7 Days", "Older"] as const).map((label) => ({
      title: label, items: unpinned.filter((item) => conversationDateGroup(item.lastMessageAtIso || item.createdAt) === label),
    })),
  ];

  function card(conversation: BuddyConversation) {
    return <div key={conversation.id} className="rounded-2xl border border-border/70 bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/buddy?conversation=${encodeURIComponent(conversation.id)}`} className="text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:underline">{conversation.title}</Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{conversation.lastMessage || "No messages yet"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{conversation.lastMessageAt ? `Last activity ${conversation.lastMessageAt}` : "No messages yet"}</p>
        </div>
        <div className="flex items-center gap-1">
          {vm.pagination.pinsAvailable !== false && <button type="button" onClick={() => void vm.pinConversation(conversation.id, !conversation.pinnedAt)} aria-label={`${conversation.pinnedAt ? "Unpin" : "Pin"} ${conversation.title}`} className="rounded-full border border-primary/20 p-2 text-primary"><Pin className="h-4 w-4" fill={conversation.pinnedAt ? "currentColor" : "none"} /></button>}
          <button type="button" onClick={() => { setTitle(conversation.title); setAction({ kind: "rename", conversation }); }} className="rounded-full px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary">Rename</button>
          <button type="button" onClick={() => setAction({ kind: "delete", conversation })} className="rounded-full px-3 py-2 text-xs font-semibold text-danger hover:bg-crisis-soft">Delete</button>
        </div>
      </div>
    </div>;
  }

  async function confirmAction() {
    if (!action || busy) return;
    const trimmed = title.trim();
    if (action.kind === "rename" && (!trimmed || trimmed.length > 100)) return;
    setBusy(true);
    const okay = action.kind === "rename"
      ? await vm.renameConversation(action.conversation.id, trimmed)
      : await vm.deleteConversation(action.conversation.id);
    setBusy(false);
    if (okay) setAction(null);
  }

  return <div className="space-y-6">
    <PageHeader label="Buddy" title="Chat history" description="Review and manage your saved Buddy conversations." action={<Link href="/buddy" className="echo-button-primary"><Bot className="h-4 w-4" aria-hidden="true" />Open Buddy</Link>} />
    <EchoCard title="Sessions" description="Only your saved Buddy conversations appear here.">
      <div className="relative mb-5"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} aria-label="Search conversations" placeholder="Search titles or messages" className="min-h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div>
      <p className="-mt-3 mb-5 text-xs text-muted-foreground">Search matches complete words.</p>
      {vm.error && <p role="alert" className="mb-3 text-sm text-danger">{vm.error}</p>}
      {vm.isLoadingList && <p role="status" className="mb-3 text-sm text-muted-foreground">Loading conversations…</p>}
      {vm.pagination.pinsAvailable === false && <p className="mb-3 text-xs text-muted-foreground">Pinning is temporarily unavailable.</p>}
      <div className="space-y-6">{groups.filter((group) => group.items.length).map((group) => <section key={group.title} aria-label={group.title} className="space-y-3"><h3 className="text-sm font-semibold text-foreground">{group.title}</h3>{group.items.map(card)}</section>)}</div>
      {!vm.isLoadingList && vm.conversations.length === 0 && <p className="text-sm text-muted-foreground">{query ? "No matching conversations." : "No conversations saved yet."}</p>}
      {vm.pagination.totalPages > 1 && <nav aria-label="Conversation pages" className="mt-5 flex items-center justify-between gap-3 text-sm"><button type="button" disabled={vm.pagination.page <= 1 || vm.isLoadingList} onClick={() => void vm.loadConversations(vm.pagination.page - 1)} className="rounded-full border border-border px-4 py-2 disabled:opacity-40">Previous</button><span>Page {vm.pagination.page} of {vm.pagination.totalPages}</span><button type="button" disabled={vm.pagination.page >= vm.pagination.totalPages || vm.isLoadingList} onClick={() => void vm.loadConversations(vm.pagination.page + 1)} className="rounded-full border border-border px-4 py-2 disabled:opacity-40">Next</button></nav>}
    </EchoCard>
    <EchoDialog open={Boolean(action)} onClose={() => { if (!busy) setAction(null); }} title={action?.kind === "delete" ? "Delete conversation" : "Rename conversation"} description={action?.kind === "delete" ? "This removes the chat and its messages from Echo's live database. Provider backups and restricted, content-free audit records follow their documented retention periods." : "Choose a title that will help you find this conversation again."}>
      {vm.error && <p role="alert" className="mb-3 text-sm text-danger">{vm.error}</p>}
      {action?.kind === "rename" && <label className="block text-sm font-medium">Conversation title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>}
      {action?.kind === "delete" && <p className="text-sm">Delete “{action.conversation.title}”? This cannot be undone.</p>}
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setAction(null)} className="rounded-full border border-border px-4 py-2">Cancel</button><button type="button" disabled={busy || (action?.kind === "rename" && !title.trim())} onClick={() => void confirmAction()} className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Working…" : action?.kind === "delete" ? "Delete" : "Save"}</button></div>
    </EchoDialog>
  </div>;
}
