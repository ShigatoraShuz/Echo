"use client";

import { useId, useState, type ReactNode } from "react";
import { CalendarDays, ClipboardList, UserRoundCheck, type LucideIcon } from "lucide-react";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { cn } from "@/shared/lib/utils";

/** Portal-only presentation primitives. They have no API or authorization responsibilities. */
export function ProfessionalHeading({ title, description, label = "Professional care", action, level = "h1" }: {
  title: string; description: string; label?: string; action?: ReactNode; level?: "h1" | "h2";
}) {
  const Title = level;
  return (
    <header className="mb-7 flex flex-col gap-5 border-b border-border/70 pb-6 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-primary">{label}</p>
        <Title className="break-words text-4xl font-medium leading-tight tracking-tight text-foreground [font-family:var(--font-echo-display)] sm:text-5xl">{title}</Title>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0 [&_button]:min-h-11 [&_a]:min-h-11">{action}</div> : null}
    </header>
  );
}

export function ProfessionalMetrics({ newRequests, activeCases, scheduled, loading = false }: {
  newRequests: number; activeCases: number; scheduled: number; loading?: boolean;
}) {
  return (
    <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {[
        { label: "Pending requests", value: newRequests, hint: "Unassigned and awaiting acceptance", icon: ClipboardList },
        { label: "My active cases", value: activeCases, hint: "Accepted or scheduled · assigned to you", icon: UserRoundCheck },
        { label: "Scheduled cases", value: scheduled, hint: "Appointment times are shown in each case", icon: CalendarDays },
      ].map(({ label, value, hint, icon: Icon }, index) => (
        <div key={label} className={cn("min-w-0 rounded-3xl border border-border/70 bg-card p-5 shadow-subtle sm:p-6", index === 0 && "col-span-2 border-primary bg-primary text-primary-foreground sm:col-span-1 sm:border-border/70 sm:bg-card sm:text-foreground")}>
          <dt className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
            <span className={cn("flex min-h-10 items-center text-sm font-semibold", index === 0 ? "text-primary-foreground sm:text-foreground" : "text-foreground")}>{label}</span>
            <span className={cn("size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary sm:grid", index === 0 ? "grid" : "hidden")}><Icon size={18} aria-hidden="true" /></span>
          </dt>
          <dd>
            <div className={cn("min-h-9 break-words text-4xl font-semibold leading-none tracking-tight tabular-nums sm:min-h-10", index === 0 ? "text-5xl text-primary-foreground sm:text-4xl sm:text-foreground" : "text-foreground")}>
              {loading ? <><EchoSkeleton className="h-9 w-full max-w-14 sm:h-10" /><span className="sr-only">Loading {label.toLowerCase()}</span></> : value}
            </div>
            <span className={cn("mt-3 text-xs leading-5 sm:block", index === 0 ? "block text-primary-foreground/80 sm:text-muted-foreground" : "hidden text-muted-foreground")}>{hint}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfessionalPanel({ title, description, icon: Icon, action, children, id, className }: {
  title: string; description?: ReactNode; icon?: LucideIcon; action?: ReactNode; children: ReactNode; id?: string; className?: string;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn("min-w-0 scroll-mt-32 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-subtle", className)}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 p-4 sm:p-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/60 text-primary"><Icon size={18} aria-hidden="true" /></span> : null}
          <div className="min-w-0">
            <h2 id={headingId} className="break-words text-2xl font-medium leading-tight text-foreground [font-family:var(--font-echo-display)]">{title}</h2>
            {description ? <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="w-full max-w-full sm:w-auto">{action}</div> : null}
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function ProfessionalRequestRow({ id, status, submittedAt, action, fullId, assignment, assignedDate, updatedAt, label = "Request" }: {
  id: string; status: string; submittedAt: string; action: ReactNode; fullId?: string; assignment?: string; assignedDate?: string; updatedAt?: string; label?: "Request" | "Case";
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-5 sm:first:pt-0 sm:last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="hidden size-10 shrink-0 place-items-center rounded-xl border border-border/70 bg-background text-muted-foreground sm:grid"><ClipboardList size={18} aria-hidden="true" /></span>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-foreground">{label} {id}</h3><ProfessionalRequestStatus status={status} /></div>
          <p className="break-words text-xs leading-5 text-muted-foreground">Submitted {submittedAt}</p>
          <button type="button" className="echo-focus-ring flex min-h-11 items-center gap-2 rounded-lg text-xs font-semibold text-primary sm:hidden" aria-expanded={detailsOpen} aria-controls={detailsId} onClick={() => setDetailsOpen((open) => !open)}>{detailsOpen ? "Hide details" : `${label} details`}<span aria-hidden="true">{detailsOpen ? "−" : "+"}</span></button>
          <div id={detailsId} className={cn("space-y-2", !detailsOpen && "hidden sm:block")}>
          {updatedAt ? <p className="break-words text-xs leading-5 text-muted-foreground">Updated {updatedAt}</p> : null}
          {fullId ? <p className="break-all text-xs leading-5 text-muted-foreground">ID: {fullId}</p> : null}
          {assignment ? <p className="break-words text-xs leading-5 text-muted-foreground">Assigned: {assignment}</p> : null}
          {assignedDate ? <p className="break-words text-xs leading-5 text-muted-foreground">{assignedDate}</p> : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center [&_a]:w-full [&_a]:justify-center [&_button]:min-h-11 [&_button]:w-full sm:justify-end sm:[&_a]:w-auto sm:[&_button]:w-auto">{action}</div>
    </li>
  );
}

export function ProfessionalQueueLoading() {
  return (
    <div role="status" aria-label="Loading request queue" aria-busy="true" className="divide-y divide-border/70">
      <span className="sr-only">Loading request queue</span>
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex items-center justify-between gap-4 py-5 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-1 items-center gap-3"><EchoSkeleton className="size-10 shrink-0 rounded-xl" /><div className="w-full max-w-xs space-y-2"><EchoSkeleton className="h-4 w-3/4" /><EchoSkeleton className="h-3 w-1/2" /></div></div>
          <EchoSkeleton className="h-10 w-24 shrink-0 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function ProfessionalAppointment({ startsAt, status, mode, location, action }: {
  startsAt: string; status: string; mode: string; location: string; action?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/70 bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-foreground">{startsAt}</strong><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-primary">{status}</span></div>
      <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{mode} · {location}</p>
      {action ? <div className="mt-4 border-t border-border/70 pt-3">{action}</div> : null}
    </div>
  );
}

export function ProfessionalNotice({ title, children, role, tone = "neutral" }: {
  title: string; children: ReactNode; role?: "alert" | "status"; tone?: "neutral" | "danger";
}) {
  return (
    <div role={role} className={cn("rounded-2xl border p-5 text-sm leading-6", tone === "danger" ? "border-danger/30 bg-danger/10 text-foreground" : "border-border bg-secondary/40 text-muted-foreground")}>
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

export function ProfessionalRequestStatus({ status }: { status: string }) {
  const label = status === "submitted" ? "New request" : status === "assigned" ? "Accepted" : status === "scheduled" ? "Scheduled" : status === "closed" ? "Closed" : status === "declined" ? "Declined" : "Status unavailable";
  const treatment = status === "submitted"
    ? "border-warning/25 bg-[hsl(var(--warning-surface))] text-foreground"
    : status === "scheduled"
      ? "border-success/25 bg-[hsl(var(--success-surface))] text-foreground"
      : status === "closed" || label === "Status unavailable"
        ? "border-border bg-muted text-muted-foreground"
        : status === "assigned"
          ? "border-primary/15 bg-secondary text-primary"
          : "border-danger/25 bg-[hsl(var(--danger-surface))] text-foreground";
  const dot = status === "submitted" ? "bg-warning" : status === "scheduled" ? "bg-success" : status === "closed" || label === "Status unavailable" ? "bg-muted-foreground" : status === "assigned" ? "bg-primary" : "bg-danger";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${treatment}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
