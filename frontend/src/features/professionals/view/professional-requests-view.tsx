"use client";

import { useState } from "react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { ProfessionalAssignmentPanel } from "../components/professional-assignment-panel";
import { useSearchParams } from "next/navigation";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalNotice, ProfessionalPanel } from "../components/professional-ui";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { ProfessionalRequestQueue } from "../components/professional-request-queue";
import { useProfessionalWorkspace } from "../hooks/use-professional-workspace";

export function ProfessionalRequestsView() {
  return <ProfessionalRequestWorkspace myCases={false} />;
}
export function ProfessionalMyCasesView() {
  return <ProfessionalRequestWorkspace myCases />;
}
function ProfessionalRequestWorkspace({ myCases }: { myCases: boolean }) {
  const params = useSearchParams();
  return <RequestWorkspace key={`${myCases}:${params.toString()}`} myCases={myCases} />;
}
function RequestWorkspace({ myCases }: { myCases: boolean }) {
  const workspace = useProfessionalWorkspace(myCases ? "/professional/my-cases" : "/professional/requests");
  const { memberships, organizationId, activeMembership, requests, error, busyId, selectionNotice, success } = workspace;
  const [assigning, setAssigning] = useState("");
  const [assignmentNotice, setAssignmentNotice] = useState("");
  return <ProfessionalShell memberships={memberships ?? undefined} organizationId={organizationId} onOrganizationChange={workspace.switchOrganization} organizationDisabled={!!busyId}>
    <ProfessionalHeading title={myCases ? "My cases" : "Support requests"} label={myCases ? "Your professional caseload" : "Organization queue"} description={myCases ? "The people and next steps entrusted to you." : "Review new requests and coordinate the next step."} action={<EchoButton type="button" variant="outline" onClick={workspace.refreshWorkspace} disabled={!organizationId || requests === null || !!busyId || !!error}>{myCases ? "Refresh my cases" : "Refresh requests"}</EchoButton>} />
    {selectionNotice ? <div className="mb-6"><ProfessionalNotice title="Organization selection updated">{selectionNotice}</ProfessionalNotice></div> : null}
    {error ? <ProfessionalAccessError failure={error} destination={workspace.destination} onRetry={workspace.retry} retryLabel="Retry workspace" /> : memberships === null || !organizationId ? <ProfessionalSkeleton title="Loading your organizations" variant="content" /> : <>
      <details className="mb-3 break-words text-xs leading-6 text-muted-foreground"><summary className="echo-focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-lg font-semibold text-primary">{activeMembership?.organization?.name} · About this overview</summary><p>{activeMembership?.organization?.name}. {myCases ? "Cases shown here come from up to 100 recent organization requests. Older assigned cases may be outside this view. Assignment timestamps are not supplied in this overview." : "This queue contains up to 100 recent requests. Older records may be outside this view."}</p></details>
      {assignmentNotice && !error ? <p role="status" className="mb-4 text-sm font-semibold text-primary">{assignmentNotice}</p> : null}
      {success ? <p role="status" className="mb-4 text-sm font-semibold text-primary">{success}</p> : null}
      {myCases && !workspace.canClaim ? <ProfessionalPanel title="A workspace for your role"><p className="text-sm leading-7 text-muted-foreground">Your role supports organization coordination. Clinical caseloads are available to assigned counselors, psychologists and social workers.</p><a href={`/professional/requests?organization=${encodeURIComponent(organizationId)}`} className="echo-focus-ring mt-4 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline">View organization requests</a></ProfessionalPanel> : <ProfessionalRequestQueue key={organizationId} requests={requests} organizationId={organizationId} organizationName={activeMembership?.organization?.name ?? "your organization"} userId={workspace.userId} canClaim={!myCases && workspace.canClaim} canOpenCases={workspace.canClaim} canAssign={!myCases && workspace.canAssign} onAssignRequest={item => { setAssignmentNotice(""); setAssigning(item.id); }} busyId={busyId} onClaim={(item) => workspace.claim(item.id)} myCases={myCases} />}
      <EchoDialog open={!!assigning && workspace.canAssign && !!requests && !error} onClose={() => setAssigning("")} title="Assign practitioner" description="Select an eligible practitioner in this organization. Assignment does not grant clinical access to your admin account.">
        {assigning && requests ? <ProfessionalAssignmentPanel initialRequestId={assigning} organizationId={organizationId} requests={requests} busy={!!busyId} onAssign={workspace.assign} onAssignmentConfirmed={(requestId, displayName) => { setAssignmentNotice("Assigned " + displayName + " to request " + requestId.slice(0,8).toUpperCase() + ". Clinical access remains restricted."); setAssigning(""); }} /> : null}
      </EchoDialog>
    </>}
  </ProfessionalShell>;
}
