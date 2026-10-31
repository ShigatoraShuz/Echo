"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { appointmentTime } from "../professional-appointments.model";
import { ProfessionalPanel } from "./professional-ui";

export interface SyntheticFollowUp {
  id: string; organizationId: string; caseId: string; kind: "review" | "prepare" | "follow_up";
  status: "pending" | "completed"; dueAt: string; practitioner: string;
}
const labels = { review: "Review agreed next steps", prepare: "Prepare for consultation", follow_up: "Check agreed follow-up" };

/** No task API exists. Records are accepted only as explicitly synthetic preview fixtures. */
export function ProfessionalFollowUps({ preview, state = "ready", now = Date.now() }: {
  preview?: { organizationId: string; tasks: SyntheticFollowUp[] };
  state?: "ready" | "loading" | "empty" | "error"; now?: number;
}) {
  const [filter, setFilter] = useState<"pending" | "completed">("pending");
  const items = preview && state === "ready" ? preview.tasks.filter((item) => item.organizationId === preview.organizationId && item.status === filter) : [];
  return <ProfessionalPanel title="Follow-up tasks" icon={ListChecks} description={preview ? "Fictional tasks for local interface inspection. Nothing is created, completed or persisted." : "Task tracking is awaiting backend integration."}>
    {!preview ? <><p className="text-sm leading-7 text-muted-foreground">A professional task service is not available. Review the authorized case notes and appointments for agreed next steps.</p><EchoButton size="small" variant="outline" className="mt-4" disabled>Create follow-up unavailable</EchoButton></> : state === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading synthetic follow-ups</p> : state === "error" ? <p role="alert" className="text-sm text-muted-foreground">Synthetic error: follow-ups could not be loaded. No task records are displayed.</p> : <>
      <div role="group" aria-label="Synthetic follow-up status" className="mb-4 flex flex-wrap gap-2"><EchoButton variant="outline" size="small" aria-pressed={filter === "pending"} onClick={() => setFilter("pending")}>Pending</EchoButton><EchoButton variant="outline" size="small" aria-pressed={filter === "completed"} onClick={() => setFilter("completed")}>Completed</EchoButton></div>
      {items.length ? <ul className="divide-y divide-border/70">{items.map((item) => <li key={item.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{labels[item.kind]}</h3><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-primary">{item.status}</span></div>
        <p className="mt-2 break-words text-xs leading-6 text-muted-foreground">Fictional practitioner: {item.practitioner}</p>
        <p className="text-xs leading-6 text-muted-foreground">Due {appointmentTime(item.dueAt)}{item.status === "pending" && Date.parse(item.dueAt) < now ? " · Overdue in this synthetic scenario" : ""}</p>
        <p className="text-xs leading-6 text-muted-foreground">Fictional case {item.caseId}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><a href="#sample-case" className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary underline">Inspect synthetic case example</a><EchoButton variant="outline" size="small" disabled>{item.status === "pending" ? "Complete task unavailable" : "Reopen task unavailable"}</EchoButton></div>
      </li>)}</ul> : <p role="status" className="text-sm text-muted-foreground">No {filter} synthetic follow-ups in this view.</p>}
    </>}
  </ProfessionalPanel>;
}
