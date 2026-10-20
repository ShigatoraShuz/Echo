"use client";

import { useSearchParams } from "next/navigation";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalNotice } from "../components/professional-ui";
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
  return <ProfessionalShell memberships={memberships ?? undefined} organizationId={organizationId} onOrganizationChange={workspace.switchOrganization} organizationDisabled={!!busyId}>
    <ProfessionalHeading title={myCases ? "My cases" : "Support requests"} label={myCases ? "Your professional caseload" : "Organization queue"} description={myCases ? "Your assigned cases in the active organization, including completed cases within this overview." : "Request metadata for your approved organization. Private case content is available only to the assigned professional."} action={<EchoButton type="button" variant="outline" onClick={workspace.refreshWorkspace} disabled={!organizationId || requests === null || !!busyId || !!error}>{myCases ? "Refresh my cases" : "Refresh requests"}</EchoButton>} />
    {selectionNotice ? <div className="mb-6"><ProfessionalNotice title="Organization selection updated">{selectionNotice}</ProfessionalNotice></div> : null}
    {error ? <ProfessionalAccessError failure={error} destination={workspace.destination} onRetry={workspace.retry} retryLabel="Retry workspace" /> : memberships === null || !organizationId ? <ProfessionalSkeleton title="Loading your organizations" variant="content" /> : <>
      <p className="mb-4 break-words text-xs leading-6 text-muted-foreground">{activeMembership?.organization?.name}. {myCases ? "Cases shown here come from up to 100 recent organization requests. Older assigned cases may be outside this view. Assignment timestamps are not supplied in this overview." : "This queue contains up to 100 recent requests. Older records may be outside this view."}</p>
      {success ? <p role="status" className="mb-4 text-sm font-semibold text-primary">{success}</p> : null}
      <ProfessionalRequestQueue key={organizationId} requests={requests} organizationId={organizationId} organizationName={activeMembership?.organization?.name ?? "your organization"} userId={workspace.userId} canClaim={!myCases && workspace.canClaim} canOpenCases={workspace.canClaim} busyId={busyId} onClaim={(item) => workspace.claim(item.id)} myCases={myCases} />
    </>}
  </ProfessionalShell>;
}
