"use client";

import Link from "next/link";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowRight, ClipboardList } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoEmptyState } from "@/shared/components/feedback/echo-empty-state";
import type { QueueRequest } from "@/services/professionals/professional-api";
import { ProfessionalPanel, ProfessionalQueueLoading, ProfessionalRequestRow } from "./professional-ui";
import { isPendingRequest } from "../professional-dashboard.model";
import { defaultRequestFilters, filterProfessionalRequests, isMyCase, professionalCaseHref, requestDate, type ProfessionalRequestFilters } from "../professional-request.model";
import { ProfessionalRequestFilterControls } from "./professional-request-filters";
import { ProfessionalClaimDialog } from "./professional-claim-dialog";

export interface ProfessionalQueueHandle { viewScheduled: () => void }
export function ProfessionalRequestQueue(props: Parameters<typeof ScopedRequestQueue>[0]) {
  return <ScopedRequestQueue key={`${props.organizationId}:${props.userId}:${!!props.myCases}`} {...props} />;
}

function ScopedRequestQueue({ requests, organizationId, organizationName, userId, canClaim = false, canOpenCases = false, busyId = "", onClaim, compact = false, preview = false, myCases = false, assignedDates, ref }: {
  requests: QueueRequest[] | null; organizationId: string; organizationName: string; userId: string;
  canClaim?: boolean; canOpenCases?: boolean; busyId?: string; onClaim?: (item: QueueRequest) => Promise<boolean>; compact?: boolean; preview?: boolean; myCases?: boolean; assignedDates?: Record<string, string>; ref?: Ref<ProfessionalQueueHandle>;
}) {
  const [filters, setFilters] = useState<ProfessionalRequestFilters>({ ...defaultRequestFilters });
  const [expanded, setExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const [candidate, setCandidate] = useState<QueueRequest | null>(null);
  const [confirmationFailure, setConfirmationFailure] = useState("");
  const confirmationPending = useRef(false);
  const mounted = useRef(false);
  const statusSelect = useRef<HTMLSelectElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { scoped, visible, practitioners, applied, dateError } = filterProfessionalRequests(requests ?? [], organizationId, userId, filters, myCases);
  function changeFilters(next: ProfessionalRequestFilters) { setFilters(next); setExpanded(false); }
  async function confirm() {
    if (preview || !candidate || !onClaim || busyId || confirmationPending.current) return;
    confirmationPending.current = true;
    try { await onClaim(candidate); if (mounted.current) setCandidate(null); }
    catch { if (mounted.current) setConfirmationFailure("Acceptance could not be confirmed. Close this dialog and refresh the queue before trying again."); }
    finally { confirmationPending.current = false; }
  }
  const limit = compact ? 5 : 10;
  useImperativeHandle(ref, () => ({ viewScheduled() {
    setFilters({ ...defaultRequestFilters, mineOnly: true, status: "scheduled" }); setExpanded(true);
    statusSelect.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView?.({ behavior: "instant", block: "start" });
  } }));
  return <div ref={panel}><ProfessionalPanel id="requests" title={myCases ? "Assigned cases" : "Request queue"} icon={ClipboardList}
    description={myCases ? `Assigned to you in ${organizationName}. Submitted and updated dates are separate from assignment dates.` : `Showing only ${organizationName}. Pending requests appear first, oldest first, followed by your active cases.`}
    action={<div className="flex flex-wrap items-center gap-3"><EchoButton type="button" variant="outline" size="small" className={filters.mineOnly ? "min-h-11 border-primary/25 bg-secondary" : "min-h-11"} aria-pressed={filters.mineOnly} disabled={requests === null} onClick={() => changeFilters({ ...filters, mineOnly: !filters.mineOnly, status: "all" })}>My active cases</EchoButton><label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">Status<select ref={statusSelect} disabled={requests === null} className="echo-focus-ring min-h-11 max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={filters.status} onChange={(event) => changeFilters({ ...filters, status: event.target.value })}><option value="all">All</option>{!myCases ? <option value="submitted">New</option> : null}<option value="assigned">Accepted</option><option value="scheduled">Scheduled</option><option value="closed">Closed</option><option value="declined">Declined</option></select></label></div>}
  >
    <div className="mb-5">{compact ? <details className="rounded-2xl border border-border bg-background p-4"><summary className="echo-focus-ring flex min-h-11 cursor-pointer items-center gap-3 rounded-lg text-sm font-semibold text-primary">Search and filters{applied ? " · Applied" : ""}</summary><div className="mt-4"><ProfessionalRequestFilterControls filters={filters} onChange={changeFilters} practitioners={practitioners} disabled={requests === null} applied={applied} dateError={dateError} myCases={myCases} /></div></details> : <><button type="button" className="echo-focus-ring flex min-h-11 w-full items-center justify-between rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-primary sm:hidden" aria-expanded={filtersOpen} aria-controls={filtersId} onClick={() => setFiltersOpen((value) => !value)}><span>Search and filters{applied ? " ? Applied" : ""}</span><span aria-hidden="true">{filtersOpen ? "?" : "+"}</span></button><div id={filtersId} className={filtersOpen ? "mt-4 sm:mt-0" : "hidden sm:block"}><ProfessionalRequestFilterControls filters={filters} onChange={changeFilters} practitioners={practitioners} disabled={requests === null} applied={applied} dateError={dateError} myCases={myCases} /></div></>}</div>
    {requests !== null ? <p role="status" className="mb-4 text-xs leading-6 text-muted-foreground">{visible.length} matching {myCases ? "cases" : "requests"} from {scoped.length} loaded in this organization.</p> : null}
    {requests === null ? <ProfessionalQueueLoading /> : dateError ? null : visible.length === 0 ? <EchoEmptyState icon={<ClipboardList size={22} />} title={scoped.length === 0 ? myCases ? "No assigned cases in this overview." : "No requests in this organization yet." : myCases ? "No cases match this view." : "No requests match this view."} description={scoped.length === 0 ? myCases ? "Your assigned cases will appear here when included in the loaded queue. Older records may be outside this overview." : "New support requests will appear here when submitted to your organization." : "Clear filters or change the selected status, date, practitioner or request ID."} className="py-8" /> : <ul id={listId} className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-border/70">{visible.slice(0, expanded ? undefined : limit).map((item) => <ProfessionalRequestRow key={item.id} id={item.id.slice(0, 8).toUpperCase()} label={myCases ? "Case" : "Request"} fullId={item.id} status={item.status} submittedAt={requestDate(item.createdAt)} updatedAt={requestDate(item.updatedAt)} assignment={item.assignedTo === userId ? "You" : item.assignedTo ? `Practitioner ID ${item.assignedTo}` : "Unassigned"} assignedDate={myCases ? preview && assignedDates?.[item.id] ? `Assigned ${requestDate(assignedDates[item.id])} · Synthetic` : "Assigned date unavailable in this overview." : undefined}
      action={isMyCase(item, userId) ? !canOpenCases ? <span className="text-xs leading-6 text-muted-foreground">Clinical case access is unavailable for your role.</span> : preview ? <EchoButton type="button" size="small" variant="outline" disabled>Open synthetic case</EchoButton> : <Link href={professionalCaseHref(item.id, organizationId)} className="echo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/25 px-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary motion-reduce:transition-none">Open case<ArrowRight size={15} aria-hidden="true" /></Link> : isPendingRequest(item) && canClaim ? <EchoButton type="button" size="small" className="min-h-11" isLoading={busyId === item.id} loadingText="Accepting" disabled={preview || !!busyId || !onClaim} onClick={() => { setConfirmationFailure(""); setCandidate(item); }}>Accept request</EchoButton> : <span className="text-xs text-muted-foreground">{item.assignedTo ? "Assigned elsewhere" : "Unassigned"}</span>}
    />)}</ul>}
    {requests !== null && visible.length > limit ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4"><p className="text-xs leading-6 text-muted-foreground">Showing {expanded ? visible.length : limit} of {visible.length} matching requests.</p><EchoButton type="button" size="small" variant="outline" className="min-h-11" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((value) => !value)}>{expanded ? "Show fewer requests" : `Show all ${visible.length} matching requests`}</EchoButton></div> : null}
  </ProfessionalPanel><ProfessionalClaimDialog request={candidate} organizationName={organizationName} onClose={() => setCandidate(null)} onConfirm={() => void confirm()} busy={!!busyId} preview={preview} failure={confirmationFailure} /></div>;
}
