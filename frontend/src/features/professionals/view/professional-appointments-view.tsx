"use client";

import { appointmentsChanged, useWorkspaceRefresh } from "@/shared/hooks/use-workspace-refresh";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { ROUTES } from "@/config/routes.config";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { ProfessionalSupportHeader } from "../components/professional-support-header";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import { professionalApi, type ProfessionalAppointment } from "@/services/professionals/professional-api";
import { ProfessionalSupportNav } from "../components/professional-support-nav";

const format = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(value));

export function ProfessionalAppointmentsView() {
  const version = useRef(0); const active = useRef(true); const mutation = useRef(false);
  const [items, setItems] = useState<ProfessionalAppointment[] | null>(null);
  const [feedback,setFeedback] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!active.current) return;
    const current = ++version.current;
    setError("");
    try { const result = await professionalApi.appointments(); if (active.current && version.current === current) setItems(result.appointments); }
    catch (reason) { if (active.current && version.current === current) { setItems([]); setError(normalizeError(reason).userMessage); } }
  }, []);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; version.current++; }; }, [load]);
  useWorkspaceRefresh(() => { if (!mutation.current) void load(); }, "student-appointments", () => { active.current = false; version.current++; setItems(null); setError(""); setFeedback(""); });
  async function respond(item: ProfessionalAppointment, action: "accept" | "decline" | "cancel" | "change") {
    if (!active.current || mutation.current) return;
    if (action === "cancel" && !window.confirm("Cancel this appointment?")) return;
    mutation.current = true; const scope = version.current;
    setBusy(`${item.id}:${action}`); setError("");
    try {
      if (action === "cancel") { const result = await professionalApi.cancelAppointment(item.id); if (active.current) setFeedback(result.warning ?? ""); }
      else if (action === "change") {
        const preferredTime = window.prompt("What time would work better for you?");
        if (!preferredTime?.trim()) return;
        await professionalApi.requestAppointmentChange(item.id, preferredTime.trim());
      } else { const result = await professionalApi.respondAppointment(item.id, action === "accept"); if (active.current) setFeedback(result.warning ?? ""); }
      if (active.current && scope === version.current) { await load(); appointmentsChanged(); }
    } catch (reason) { if (active.current && scope === version.current) setError(normalizeError(reason).userMessage); }
    finally { mutation.current = false; if (active.current) setBusy(""); }
  }
  const upcoming = items?.filter((item) => ["proposed", "confirmed"].includes(item.status) && new Date(item.endsAt) > new Date()) ?? [];
  const previous = items?.filter((item) => !upcoming.includes(item)) ?? [];
  return (
    <AppShell>
      <ProfessionalSupportNav />
      <ProfessionalSupportHeader label="Your schedule" title="Appointments" description="Review appointment proposals and previous consultations. Times are shown in your device timezone." />
      {items === null ? <div role="status" aria-busy="true" className="space-y-3"><span className="sr-only">Loading appointments</span>{[0,1].map((item) => <EchoSkeleton key={item} variant="rectangular" className="h-32" />)}</div> : error && items.length === 0 ? null : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section><h2 className="mb-3 text-2xl [font-family:var(--font-echo-display)]">Upcoming</h2>{upcoming.length ? <div className="space-y-3">{upcoming.map((item) => <AppointmentCard key={item.id} item={item} busy={busy} onAction={respond} />)}</div> : <div className="rounded-2xl border border-border bg-card p-7 text-sm text-muted-foreground">No upcoming appointment. <Link href={ROUTES.professionalSupport.discover} className="font-bold text-primary underline">Find support</Link></div>}</section>
          <section><h2 className="mb-3 text-2xl [font-family:var(--font-echo-display)]">Previous</h2><div className="space-y-3">{previous.length ? previous.map((item) => <div key={item.id} className="rounded-2xl border border-border bg-card p-4"><strong className="text-sm">{format(item.startsAt)}</strong><p className="mt-1 text-xs capitalize text-muted-foreground">{item.mode.replaceAll("_", " ")} · {item.status}{item.locationHint ? ` · ${item.locationHint}` : ""}</p>{item.requestId ? <Link href={ROUTES.professionalSupport.request(item.requestId)} className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-primary">View case</Link> : null}</div>) : <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">No previous appointments.</p>}</div></section>
        </div>
      )}
      {feedback ? <p role="status" className="mt-4 text-sm text-muted-foreground">{feedback}</p> : null}
      {error ? <div role="alert" className="mt-5 text-sm text-danger">{error} <button type="button" onClick={() => void load()} className="ml-2 min-h-11 font-semibold underline underline-offset-2">Reload appointments</button></div> : null}
    </AppShell>
  );
}

function AppointmentCard({ item, busy, onAction }: { item: ProfessionalAppointment; busy: string; onAction: (item: ProfessionalAppointment, action: "accept" | "decline" | "cancel" | "change") => Promise<void> }) {
  return <article className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap justify-between gap-4"><div><p className="flex items-center gap-2 font-bold"><CalendarDays size={17} className="text-primary" /> {format(item.startsAt)}</p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={14} /> {item.mode.replaceAll("_", " ")} · {item.status}</p>{item.locationHint ? <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={14} /> {item.locationHint}</p> : null}</div><div className="flex flex-wrap gap-2">{item.status === "proposed" ? <><EchoButton size="small" className="min-h-11" disabled={Boolean(busy)} onClick={() => void onAction(item, "accept")}>Accept</EchoButton><EchoButton size="small" className="min-h-11" variant="outline" disabled={Boolean(busy)} onClick={() => void onAction(item, "decline")}>Decline</EchoButton></> : <EchoButton size="small" className="min-h-11" variant="outline" disabled={Boolean(busy)} onClick={() => void onAction(item, "cancel")}>Cancel</EchoButton>}<EchoButton size="small" className="min-h-11" variant="ghost" disabled={Boolean(busy)} onClick={() => void onAction(item, "change")}>Request change</EchoButton></div></div></article>;
}
