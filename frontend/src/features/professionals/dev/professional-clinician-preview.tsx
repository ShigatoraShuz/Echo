"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, LogOut, MessageCircle, Settings, ShieldCheck, UserRound, UserRoundCheck } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalShell } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalMetrics, ProfessionalPanel } from "../components/professional-ui";
import { ProfessionalRequestQueue } from "../components/professional-request-queue";
import { ProfessionalCaseOverview } from "../components/professional-case-overview";
import { ProfessionalCaseSharing, type PreviewConsentState } from "../components/professional-case-sharing";
import { ProfessionalCaseTimeline } from "../components/professional-case-timeline";
import { ProfessionalCaseNoteEditor } from "../components/professional-case-note-editor";
import { ProfessionalAppointmentAgenda } from "../components/professional-appointment-agenda";
import { ProfessionalAppointmentForm } from "../components/professional-appointment-form";
import { ProfessionalCaseReferrals } from "../components/professional-case-referrals";
import { ProfessionalFollowUps } from "../components/professional-follow-ups";
import { professionalDashboardOverview } from "../professional-dashboard.model";
import { clinicianDemo, clinicianPersonas, demoNow, demoOrganization, type ClinicianPersona } from "./clinician-preview-fixtures";
import { ClinicianPreviewMessages } from "./clinician-preview-messages";
import { professionalPreviewExit } from "./professional-preview-navigation";

const path = "/dev/professional-preview";
const destinations = [
  { page: "today", label: "Today", icon: LayoutDashboard },
  { page: "requests", label: "Requests", icon: ClipboardList },
  { page: "my-cases", label: "My cases", icon: UserRoundCheck },
  { page: "calendar", label: "Calendar", icon: CalendarDays },
  { page: "resources", label: "Resources", icon: HeartHandshake },
  { page: "settings", label: "Settings", icon: Settings },
];
type DemoLocation = { page: string; caseId: string };
function locationFromHash(hash: string): DemoLocation {
  const [page = "today", rawId = ""] = hash.replace(/^#/, "").split("/");
  let caseId = "";
  try { caseId = decodeURIComponent(rawId); } catch { /* Unknown demo IDs never reach a service. */ }
  return { page: page === "case" || page === "sample-case" || destinations.some(item => item.page === page) ? page : "today", caseId };
}

/** This entry is aliased out of production. No authenticated clinician or membership is created. */
export function ProfessionalClinicianPreview() {
  const [persona, setPersona] = useState<ClinicianPersona>("counselor");
  if (process.env.NODE_ENV === "production") return null;
  return <ClinicianWorkspace key={persona} persona={persona} onPersona={next => { if (clinicianPersonas.some(item => item.id === next)) { window.history.replaceState(null, "", window.location.pathname + window.location.search + "#my-cases"); setPersona(next); } }} />;
}

function ClinicianWorkspace({ persona, onPersona }: { persona: ClinicianPersona; onPersona: (persona: ClinicianPersona) => void }) {
  const params = useSearchParams();
  const demo = useMemo(() => clinicianDemo(persona), [persona]);
  const [location, setLocation] = useState<DemoLocation>({ page: "today", caseId: "" });
  const [messagesOpen, setMessagesOpen] = useState(false);
  const messagesTrigger = useRef<HTMLButtonElement>(null);
  const keyboard = useRef(false);
  const exitHref = professionalPreviewExit(params.get("returnOrganization"));
  const previewBase = path + (exitHref.includes("?organization=") ? "?returnOrganization=" + encodeURIComponent(params.get("returnOrganization")!) : "");
  const navigationItems = useMemo(() => destinations.map(item => ({ label: item.label, href: previewBase + "#" + item.page, icon: item.icon })), [previewBase]);
  const closeMessages = useCallback(() => { setMessagesOpen(false); requestAnimationFrame(() => messagesTrigger.current?.focus()); }, []);
  useEffect(() => {
    const sync = () => { setLocation(locationFromHash(window.location.hash)); setMessagesOpen(false); };
    const clear = () => setMessagesOpen(false);
    const hide = () => { if (document.visibilityState === "hidden") clear(); };
    if (!window.location.hash) { window.history.replaceState(null, "", window.location.pathname + window.location.search + "#today"); window.dispatchEvent(new HashChangeEvent("hashchange")); }
    sync(); window.addEventListener("hashchange", sync); window.addEventListener("popstate", sync); window.addEventListener("echo:sensitive-state-cleared", clear); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync); window.removeEventListener("echo:sensitive-state-cleared", clear); document.removeEventListener("visibilitychange", hide); };
  }, []);
  function navigate(page: string, caseId = "") {
    const target = "#" + page + (caseId ? "/" + encodeURIComponent(caseId) : "");
    window.location.hash = target;
    setLocation(locationFromHash(target)); setMessagesOpen(false);
    requestAnimationFrame(() => { document.getElementById("professional-content")?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); });
  }
  const selectedCase = demo.cases.find(item => item.request.id === (location.page === "sample-case" ? demo.cases[0].request.id : location.caseId));
  const page = location.page === "sample-case" ? "case" : location.page;
  const overview = professionalDashboardOverview(demo.queue, demoOrganization.id, demo.actorId);
  const openCase = (id: string) => navigate("case", id);
  const queue = (myCases = false, compact = false) => <ProfessionalRequestQueue key={persona + page} preview requests={demo.queue} organizationId={demoOrganization.id} organizationName={demoOrganization.name} userId={demo.actorId} canClaim canOpenCases myCases={myCases} compact={compact} onPreviewOpen={item => openCase(item.id)} assignedDates={Object.fromEntries(demo.cases.map(item => [item.request.id, "2026-10-10T04:00:00Z"]))} />;
  return <ProfessionalShell navigationItems={navigationItems} accountActions={<span className="flex items-center gap-2 text-xs font-semibold text-primary"><span className="pro-account-avatar"><UserRound size={18} /></span>{demo.identity.name}</span>} presentation={{ page: page === "case" ? "cases" : page, title: page === "case" ? "Case workspace" : destinations.find(item => item.page === page)?.label ?? "Clinician demo", onNavigate: href => { const next = locationFromHash(href.split("#")[1] ?? "today"); setLocation(next); setMessagesOpen(false); }, organization: <div className="pro-organization"><label htmlFor="demo-organization" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo organization</label><select id="demo-organization" className="echo-focus-ring min-h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground disabled:cursor-default disabled:opacity-70" disabled value={demoOrganization.id}><option value={demoOrganization.id}>{demoOrganization.name}</option></select></div>, commands: <><button ref={messagesTrigger} type="button" aria-label="Messages" aria-haspopup="dialog" aria-expanded={messagesOpen} onClick={event => { keyboard.current = event.detail === 0; setMessagesOpen(true); }} className="echo-focus-ring pro-command-icon"><MessageCircle size={20} aria-hidden="true" /></button><button type="button" aria-label="Notifications unavailable in demo" disabled className="pro-command-icon"><Bell size={20} aria-hidden="true" /></button></> }}>
    <section className="pro-demo-controls" aria-label="Preview controls"><div className="min-w-0"><p className="pro-demo-label"><ShieldCheck size={15} aria-hidden="true" />Demo Preview — Fictional Data</p><p className="mt-1 text-xs leading-5 text-muted-foreground">No real cases, verified credentials or clinical access. Changes are never saved.</p></div><label className="text-xs font-semibold">Clinician persona<select className="echo-input mt-1 min-h-11" value={persona} onChange={event => onPersona(event.target.value as ClinicianPersona)}>{clinicianPersonas.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><Link prefetch={false} href={exitHref} className="echo-focus-ring pro-demo-exit"><LogOut size={16} aria-hidden="true" />Exit Preview</Link></section>
    {page === "today" ? <><ProfessionalHeading label="Fictional workspace overview" title="Today, at a glance" description="Your demo priorities, in one place." /><ProfessionalMetrics newRequests={overview.pendingCount} activeCases={overview.activeCount} scheduled={overview.scheduledCases.length} /><p className="mb-5 text-xs leading-6 text-muted-foreground">All counts reflect the fixed fictional dataset. Demo reference date: 13 October 2026.</p><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">{queue(false,true)}<div className="space-y-5"><ProfessionalPanel title="Your next conversation" icon={CalendarDays} description="Fictional appointment · 14 October 2026"><p className="text-sm leading-6">One confirmed demonstration appointment.</p><EchoButton size="small" variant="outline" className="mt-4" onClick={() => openCase(demo.cases[1].request.id)}>Open demo case<ArrowRight size={15} /></EchoButton></ProfessionalPanel><ProfessionalFollowUps now={demoNow} preview={{ organizationId: demoOrganization.id, tasks: demo.tasks }} /></div></div></> : null}
    {page === "requests" || page === "my-cases" ? <><ProfessionalHeading title={page === "my-cases" ? "My cases" : "Support requests"} label={page === "my-cases" ? "Your fictional caseload" : "Fictional intake queue"} description={page === "my-cases" ? "Explore the cases and next steps in this demo." : "Review fictional requests. Accepting and assigning are disabled."} />{queue(page === "my-cases")}</> : null}
    {page === "case" ? selectedCase ? <DemoCase key={persona + selectedCase.request.id} detail={selectedCase} demo={demo} onBack={() => navigate("my-cases")} /> : <ProfessionalPanel title="Unknown demo case"><p className="text-sm leading-6">This ID is not in the fictional dataset. No case service is contacted.</p><EchoButton variant="outline" className="mt-4" onClick={() => navigate("my-cases")}>Return to demo cases</EchoButton></ProfessionalPanel> : null}
    {page === "calendar" ? <><ProfessionalHeading title="Calendar" label="Your fictional schedule" description="Fixed demonstration appointments · reference date 13 October 2026." /><div className="pro-calendar-agenda space-y-5">{demo.cases.filter(item => item.appointments.length).map(item => <ProfessionalAppointmentAgenda key={item.request.id} preview now={demoNow} appointments={item.appointments} caseId={item.request.id} organizationId={demoOrganization.id} viewer="professional" canCancel><EchoButton size="small" variant="outline" className="mt-4" onClick={() => openCase(item.request.id)}>Open demo case<ArrowRight size={15} /></EchoButton></ProfessionalAppointmentAgenda>)}</div></> : null}
    {page === "resources" ? <><ProfessionalHeading title="Professional resources" label="Fictional support directory" description="Inspect the resource presentation without contacting a service." /><p className="pro-crisis-banner mb-5 text-sm leading-6">These demo resources are fictional and must not be used for care or emergencies. Follow your organization’s actual emergency procedures.</p><div className="pro-directory-grid">{["Community support", "Care coordination"].map(label => <article key={label} className="pro-resource-card"><p className="text-xs text-muted-foreground">Fictional resource · no contact details</p><h2 className="mt-2 text-lg font-semibold">{label} demonstration</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Layout example only. No service, availability or referral delivery is represented.</p><EchoButton variant="outline" size="small" disabled className="mt-4">Contact disabled</EchoButton></article>)}</div></> : null}
    {page === "settings" ? <><ProfessionalHeading title="Demo workspace settings" label="Fictional persona" description="Your real account and professional memberships are unchanged." /><ProfessionalPanel title="Demo identity" icon={UserRound}><dl className="grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Persona</dt><dd className="mt-2 font-semibold">{demo.identity.name}</dd></div><div><dt className="text-xs text-muted-foreground">Credentials</dt><dd className="mt-2">None. This is a fictional presentation persona.</dd></div></dl><p className="mt-5 text-sm leading-6 text-muted-foreground">No account settings, role assignments, MFA or membership status can be changed here.</p><Link prefetch={false} href={path + "?view=lab" + (params.get("returnOrganization") ? "&returnOrganization=" + encodeURIComponent(params.get("returnOrganization")!) : "")} className="echo-focus-ring mt-4 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline">Open component laboratory</Link></ProfessionalPanel></> : null}
    {messagesOpen ? <ClinicianPreviewMessages key={persona} demo={demo} onClose={closeMessages} instant={keyboard.current} /> : null}
  </ProfessionalShell>;
}

function DemoCase({ detail, demo, onBack }: { detail: ReturnType<typeof clinicianDemo>["cases"][number]; demo: ReturnType<typeof clinicianDemo>; onBack: () => void }) {
  const [sharing, setSharing] = useState<PreviewConsentState>(detail.request.sharingActive ? "active" : "revoked");
  const shared = { ...detail, request: { ...detail.request, sharingActive: sharing === "active" } };
  return <section id="sample-case"><ProfessionalHeading title={"Case " + detail.request.id} label="Fictional assigned case" description="Inspect shared presentation components. All clinical actions are disabled." action={<EchoButton variant="outline" onClick={onBack}><ArrowLeft size={16} />Back to demo cases</EchoButton>} /><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]"><div className="min-w-0 space-y-5"><ProfessionalCaseOverview detail={detail} preview /><label className="block text-xs font-semibold">Fictional sharing state<select className="echo-input mt-2 min-h-11" value={sharing} onChange={event => setSharing(event.target.value as PreviewConsentState)}><option value="active">Active</option><option value="revoked">Revoked</option><option value="expired">Expired</option><option value="unavailable">Unavailable</option></select></label><ProfessionalCaseSharing detail={shared} previewState={sharing} /><ProfessionalPanel title="Clinical notes" icon={ClipboardList} description="Fictional notes · read-only demonstration">{detail.notes.map(note => <article key={note.id} className="rounded-2xl border border-border bg-background p-4 text-sm leading-7">{note.body}</article>)}<ProfessionalCaseNoteEditor preview disabled value="" onChange={() => undefined} /></ProfessionalPanel><ProfessionalAppointmentAgenda preview now={demoNow} appointments={detail.appointments} caseId={detail.request.id} organizationId={demoOrganization.id} viewer="professional" canCancel><ProfessionalAppointmentForm preview disabled appointments={detail.appointments} /></ProfessionalAppointmentAgenda></div><div className="min-w-0 space-y-5"><ProfessionalCaseTimeline detail={detail} /><ProfessionalFollowUps now={demoNow} preview={{ organizationId: demoOrganization.id, tasks: demo.tasks.filter(item => item.caseId === detail.request.id) }} /><ProfessionalCaseReferrals preview disabled referrals={detail.referrals} /><ProfessionalPanel title="Case actions" icon={ShieldCheck}><p className="text-xs leading-6 text-muted-foreground">Closing, transferring, assigning and clinical mutations are disabled.</p><EchoButton variant="outline" className="mt-3" disabled>Close case</EchoButton></ProfessionalPanel></div></div></section>;
}
