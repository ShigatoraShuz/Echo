"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { requestDate } from "../professional-request.model";
import { ProfessionalPanel } from "./professional-ui";

export interface SyntheticProfessionalNotification {
  id: string; organizationId: string; kind: "case_updated" | "appointment_changed" | "follow_up"; createdAt: string; readAt: string | null;
}
const summaries = { case_updated: "A fictional case was updated.", appointment_changed: "A fictional appointment changed.", follow_up: "A fictional follow-up is due." };

/** No personal notification API is queried. Only whitelisted synthetic metadata is rendered. */
export function ProfessionalNotifications({ preview, state = "ready" }: {
  preview?: { organizationId: string; notifications: SyntheticProfessionalNotification[] };
  state?: "ready" | "loading" | "empty" | "error";
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const items = preview && state === "ready" ? preview.notifications.filter((item) => item.organizationId === preview.organizationId && Object.hasOwn(summaries, item.kind) && (!unreadOnly || !item.readAt)).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)) : [];
  return <ProfessionalPanel title="Professional notifications" icon={Bell} description={preview ? "Fictional notifications only. No delivery, subscription or read-state service is connected." : "Professional notifications are awaiting an authorized event API."}>
    {!preview ? <p className="text-sm leading-7 text-muted-foreground">Professional case updates and reminders are not connected. No unread count or notification history is available.</p> : state === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading synthetic notifications</p> : state === "error" ? <p role="alert" className="text-sm text-muted-foreground">Synthetic error: notifications could not be loaded. No previous notifications are displayed.</p> : <>
      <div role="group" aria-label="Synthetic notification filter" className="mb-4 flex flex-wrap gap-2"><EchoButton variant="outline" size="small" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All updates</EchoButton><EchoButton variant="outline" size="small" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread</EchoButton></div>
      {items.length ? <ul className="divide-y divide-border/70">{items.map((item) => <li key={item.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-semibold">{summaries[item.kind]}</p><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">{item.readAt ? "Read" : "Unread"}</span></div>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">{requestDate(item.createdAt)} · Synthetic</p>
        <p className="text-xs leading-6 text-muted-foreground">Open the permitted case workspace for details. Sensitive content is excluded from notification summaries.</p>
        <EchoButton variant="outline" size="small" className="mt-3" disabled>{item.readAt ? "Mark unread unavailable" : "Mark read unavailable"}</EchoButton>
      </li>)}</ul> : <p role="status" className="text-sm text-muted-foreground">No {unreadOnly ? "unread " : ""}synthetic notifications in this view.</p>}
    </>}
  </ProfessionalPanel>;
}
