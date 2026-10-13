"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Building2, MapPin, Search, Stethoscope } from "lucide-react";
import { ROUTES } from "@/config/routes.config";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { ProfessionalSupportHeader } from "../components/professional-support-header";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import { professionalApi, type Organization, type PractitionerProfile } from "@/services/professionals/professional-api";
import { ProfessionalSupportNav } from "../components/professional-support-nav";

export function ProfessionalDirectoryView() {
  const [query, setQuery] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [consultationMethod, setConsultationMethod] = useState("");
  const [location, setLocation] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [items, setItems] = useState<PractitionerProfile[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void professionalApi.organizations().then((result) => setOrganizations(result.organizations)).catch(() => setOrganizations([]));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setNextCursor(null);
    const timer = window.setTimeout(() => {
      setError("");
      void professionalApi.directory({ query: query || undefined, organizationId: organizationId || undefined, specialization: specialization || undefined, serviceType: serviceType || undefined, consultationMethod: consultationMethod || undefined, location: location || undefined, limit: 24 }, controller.signal)
        .then((result) => { setItems(result.practitioners); setNextCursor(result.nextCursor); })
        .catch((reason) => { if (!controller.signal.aborted) { setItems([]); setNextCursor(null); setError(normalizeError(reason).userMessage); } });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, organizationId, specialization, serviceType, consultationMethod, location]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true); setError("");
    try {
      const result = await professionalApi.directory({ query: query || undefined, organizationId: organizationId || undefined, specialization: specialization || undefined, serviceType: serviceType || undefined, consultationMethod: consultationMethod || undefined, location: location || undefined, cursor: nextCursor, limit: 24 });
      setItems((current) => [...(current ?? []), ...result.practitioners]);
      setNextCursor(result.nextCursor);
    } catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setLoadingMore(false); }
  }

  return (
    <AppShell>
      <ProfessionalSupportNav />
      <ProfessionalSupportHeader label="Reviewed directory" title="Find Professionals" description="Search approved organizations and practitioners. Choosing a practitioner records a preference; assignment depends on availability." />
      <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-6">
        <label className="relative sm:col-span-2 xl:col-span-2"><span className="sr-only">Search practitioners or organizations</span><Search className="absolute left-3 top-3.5 text-muted-foreground" size={17} /><input className="echo-input pl-10" placeholder="Search name, credential, or specialty" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label><span className="sr-only">Filter by organization</span><select className="echo-input" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">All organizations</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span className="sr-only">Filter by specialization</span><input className="echo-input" placeholder="Specialization" value={specialization} onChange={(event) => setSpecialization(event.target.value)} /></label>
        <label><span className="sr-only">Filter by service type</span><input className="echo-input" placeholder="Service type" value={serviceType} onChange={(event) => setServiceType(event.target.value)} /></label>
        <label><span className="sr-only">Filter by consultation method</span><select className="echo-input" value={consultationMethod} onChange={(event) => setConsultationMethod(event.target.value)}><option value="">Any method</option><option value="online">Online</option><option value="in_person">In person</option><option value="phone">Phone</option></select></label>
        <label className="sm:col-span-2 xl:col-span-1"><span className="sr-only">Filter by location</span><input className="echo-input" placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} /></label>
      </div>
      {items === null ? <div role="status" aria-busy="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><span className="sr-only">Loading practitioners</span>{[0,1,2].map((item) => <EchoSkeleton key={item} variant="rectangular" className="h-72" />)}</div> : items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => <PractitionerCard key={item.id} item={item} delay={Math.min(index, 5) * 55} />)}
        </div>
      ) : error ? null : (
        <div className="rounded-3xl border border-border bg-card p-8 text-center"><Stethoscope className="mx-auto text-primary" /><h2 className="mt-4 text-2xl [font-family:var(--font-echo-display)]">No matching practitioner is available</h2><p className="mt-2 text-sm text-muted-foreground">Try a broader search or choose an organization directly.</p>{organizations[0] ? <Link className="mt-5 inline-block font-bold text-primary underline" href={`${ROUTES.professionalSupport.newRequest}?organization=${organizations[0].id}`}>Request organizational support</Link> : <Link className="mt-5 inline-block font-bold text-primary underline" href="/support/find-help">Open Find Help</Link>}</div>
      )}
      {items !== null && nextCursor ? <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mx-auto mt-6 block rounded-full border border-border bg-card px-5 py-3 text-sm font-bold text-primary disabled:opacity-60">{loadingMore ? "Loading" : "Load more practitioners"}</button> : null}
      {organizations.length ? <section className="mt-5 rounded-[1.3rem] border border-border/70 bg-card/90 p-4 shadow-subtle"><h2 className="text-sm font-bold">Organizations accepting requests</h2><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{organizations.filter((item) => !organizationId || item.id === organizationId).map((item) => <article key={item.id} className="echo-workspace-tile rounded-xl border border-border/70 bg-secondary/30 p-4"><div className="flex items-center gap-2"><Building2 size={18} className="text-primary" /><h3 className="font-semibold">{item.name}</h3></div>{item.description ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}<p className="mt-2 text-xs text-muted-foreground">{[item.location, item.serviceHours].filter(Boolean).join(" · ") || "Contact the organization for details"}</p><Link href={`${ROUTES.professionalSupport.newRequest}?organization=${item.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Request organizational support <ArrowRight size={13} /></Link></article>)}</div></section> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
    </AppShell>
  );
}

function PractitionerCard({ item, delay }: { item: PractitionerProfile; delay: number }) {
  return (
    <EchoMotionSurface as="article" tilt={false} entryDelay={delay} className="flex min-h-72 flex-col rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><Stethoscope /></span><span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold text-primary"><BadgeCheck size={13} /> Reviewed</span></div>
      <h2 className="mt-5 text-2xl [font-family:var(--font-echo-display)]">{item.displayName}</h2>
      <p className="mt-1 text-xs font-bold uppercase tracking-[.1em] text-primary">{item.credentialLabel ?? item.role.replaceAll("_", " ")}</p>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.bio || "Available for private, scheduled professional support through ECHO."}</p>
      <div className="mt-4 space-y-1 text-xs text-muted-foreground"><p className="flex items-center gap-2"><Building2 size={14} /> {item.organizationName}</p>{item.location ? <p className="flex items-center gap-2"><MapPin size={14} /> {item.location}</p> : null}</div>
      <details className="mt-4 rounded-xl border border-border/70 bg-secondary/35 p-3 text-xs"><summary className="cursor-pointer font-bold text-primary">View credentials & services</summary><dl className="mt-3 grid gap-2 text-muted-foreground"><div><dt className="font-semibold text-foreground">Credential</dt><dd>{item.credentialLabel ?? item.role.replaceAll("_", " ")}</dd></div><div><dt className="font-semibold text-foreground">Specialties</dt><dd>{item.specialties.join(", ") || "Ask the organization"}</dd></div><div><dt className="font-semibold text-foreground">Consultation</dt><dd>{item.consultationMethods.map((method) => method.replaceAll("_", " ")).join(", ") || "Ask the organization"}</dd></div>{item.responseHours ? <div><dt className="font-semibold text-foreground">Response hours</dt><dd>{item.responseHours}</dd></div> : null}</dl></details>
      <Link href={`${ROUTES.professionalSupport.newRequest}?practitioner=${item.id}&organization=${item.organizationId}`} className="mt-auto inline-flex items-center justify-between pt-5 text-sm font-bold text-primary">Request support <ArrowRight size={16} /></Link>
    </EchoMotionSurface>
  );
}
