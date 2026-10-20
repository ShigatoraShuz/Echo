"use client";

import { useState } from "react";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalCaseOverview } from "../components/professional-case-overview";
import { ProfessionalCaseSharing, type PreviewConsentState } from "../components/professional-case-sharing";
import { ProfessionalCaseTimeline } from "../components/professional-case-timeline";
import { ProfessionalCaseNoteEditor } from "../components/professional-case-note-editor";
import { ProfessionalCaseCloseDialog } from "../components/professional-case-close-dialog";
import { ProfessionalPanel } from "../components/professional-ui";
import { noteValidation } from "../professional-case.model";

/** Presentation fixtures only. This component never mounts a real case view or calls an API. */
function CaseScenario({ organizationId }: { organizationId: string }) {
  const [consent, setConsent] = useState<PreviewConsentState>("active");
  const [note, setNote] = useState("");
  const [showClose, setShowClose] = useState(false);
  const detail: CaseDetail = {
    viewer: "professional",
    request: { id: "fictional-case-sprint-3", organizationId, assignedTo: "fictional-practitioner", status: "assigned", createdAt: "2026-10-01T09:00:00+08:00", updatedAt: "2026-10-05T10:00:00+08:00", preferredTime: "Fictional afternoon preference", summary: "Fictional client message for inspecting the professional case workspace.", sharingActive: consent === "active", sharedJournalCount: 1 },
    sharedJournals: [{ journalId: "fictional-snapshot", title: "Fictional journal snapshot", body: "Synthetic reflection created for layout and consent-state inspection. No real client information." }],
    appointments: [{ id: "fictional-appointment", startsAt: "2026-10-04T10:00:00+08:00", endsAt: "2026-10-04T11:00:00+08:00", mode: "online", status: "canceled", locationHint: "Fictional meeting" }],
    notes: [{ id: "fictional-note", body: "Fictional professional note", createdAt: "2026-10-03T09:00:00+08:00" }],
    referrals: [{ id: "fictional-referral", resourceName: "Fictional support resource", resourceUrl: null, createdAt: "2026-10-05T10:00:00+08:00" }],
  };
  return <div className="mt-5 space-y-6">
    <p className="text-sm leading-7 text-muted-foreground">All case information and consent reasons below are fictional. These shared presentation components also appear in the real case workspace. No access is granted and no mutations are available.</p>
    <label className="block text-xs font-semibold">Synthetic sharing state
      <select className="echo-input mt-2 min-h-11" value={consent} onChange={(event) => { setConsent(event.target.value as PreviewConsentState); setNote(""); setShowClose(false); }}>
        <option value="active">Active</option><option value="expired">Expired</option><option value="revoked">Revoked</option><option value="unavailable">Unavailable</option>
      </select>
    </label>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-6"><ProfessionalCaseOverview detail={detail} /><ProfessionalCaseSharing detail={detail} previewState={consent} />
        <ProfessionalPanel title="Synthetic case notes" description="Inspect validation only; no saved draft or finalization is simulated.">
          <p className="text-sm leading-7">Fictional professional note</p>
          <ProfessionalCaseNoteEditor value={note} onChange={setNote} preview error={note ? noteValidation(note) : ""} />
        </ProfessionalPanel>
      </div>
      <div className="min-w-0 space-y-6"><ProfessionalCaseTimeline detail={detail} />
        <ProfessionalPanel title="Synthetic case actions">
          <EchoButton variant="outline" onClick={() => setShowClose(true)}>Inspect closure confirmation</EchoButton>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">Closure reasons, note finalization and transfer await backend contracts. No fictional success or transfer is performed.</p>
          <EchoButton variant="outline" className="mt-4" disabled>Transfer case unavailable</EchoButton>
        </ProfessionalPanel>
      </div>
    </div>
    <ProfessionalCaseCloseDialog open={showClose} onClose={() => setShowClose(false)} preview />
  </div>;
}

export function ProfessionalCasePreview({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="echo-focus-ring flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-semibold text-primary">Inspect synthetic case workspace</summary>
    {open ? <CaseScenario key={organizationId} organizationId={organizationId} /> : null}
  </details>;
}
