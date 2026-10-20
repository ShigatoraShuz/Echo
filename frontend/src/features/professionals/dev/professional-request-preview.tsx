"use client";

import { useState } from "react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import type { QueueRequest } from "@/services/professionals/professional-api";
import { ProfessionalRequestQueue } from "../components/professional-request-queue";
import { ProfessionalClaimDialog } from "../components/professional-claim-dialog";

/** Local preview owns only synthetic metadata and never mounts the real workspace hook. */
export function ProfessionalRequestPreview({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [myCases, setMyCases] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prefix = organizationId.endsWith("0") ? "QA" : "QB";
  const userId = "synthetic-queue-professional";
  const rows: QueueRequest[] = [
    { id: `${prefix}000001`, status: "submitted", assignedTo: null },
    { id: `${prefix}000002`, status: "assigned", assignedTo: userId },
    { id: `${prefix}000003`, status: "scheduled", assignedTo: "synthetic-practitioner" },
    { id: `${prefix}000004`, status: "closed", assignedTo: userId },
  ].map((item, index) => ({ ...item, organizationId, createdAt: `2026-10-${10 + index}T09:00:00Z`, updatedAt: "2026-10-13T09:00:00Z" }));
  const assignedDates = { [rows[1].id]: "2026-10-11T10:00:00Z", [rows[3].id]: "2026-10-12T10:00:00Z" };
  return <details id="request-management" onToggle={(event) => setExpanded(event.currentTarget.open)} className="mt-6 scroll-mt-32 rounded-2xl border border-border bg-card p-5">
    <summary className="echo-focus-ring flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-semibold text-primary">Inspect request management</summary>
    {expanded ? <section aria-label="Synthetic request management" className="mt-5 space-y-5">
      <p className="text-xs leading-6 text-muted-foreground">Synthetic queue, practitioner IDs and assignment dates only. Search and sorting stay in memory. Case navigation and claim mutations are disabled.</p>
      <div className="flex flex-wrap gap-3">
        <EchoButton type="button" variant="outline" aria-pressed={!myCases} onClick={() => setMyCases(false)}>Preview request queue</EchoButton>
        <EchoButton type="button" variant="outline" aria-pressed={myCases} onClick={() => setMyCases(true)}>Preview My Cases</EchoButton>
        <EchoButton type="button" variant="outline" onClick={() => setConfirmation(true)}>Inspect claim confirmation</EchoButton>
      </div>
      <ProfessionalRequestQueue key={`${organizationId}:${myCases}`} requests={rows} organizationId={organizationId} organizationName={organizationName} userId={userId} canClaim canOpenCases preview myCases={myCases} assignedDates={assignedDates} />
      <ProfessionalClaimDialog request={confirmation ? rows[0] : null} organizationName={organizationName} onClose={() => setConfirmation(false)} preview />
    </section> : null}
  </details>;
}
