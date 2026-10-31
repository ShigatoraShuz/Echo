"use client";

import { useSearchParams } from "next/navigation";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalNotice } from "../components/professional-ui";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { ProfessionalCrisisSupport } from "../components/professional-crisis-support";
import { useProfessionalWorkspace } from "../hooks/use-professional-workspace";

export function ProfessionalResourcesView() {
  const params = useSearchParams();
  return <ResourcesWorkspace key={params.toString()} />;
}

function ResourcesWorkspace() {
  const workspace = useProfessionalWorkspace("/professional/resources", "none");
  const { memberships, organizationId, activeMembership, error, selectionNotice } = workspace;
  return <ProfessionalShell memberships={memberships ?? undefined} organizationId={organizationId} onOrganizationChange={workspace.switchOrganization}>
    <ProfessionalHeading title="Professional resources" label="Support directory" description="Reviewed contacts for the moments that need more support." />
    {selectionNotice ? <div className="mb-6"><ProfessionalNotice title="Organization selection updated">{selectionNotice}</ProfessionalNotice></div> : null}
    {error ? <ProfessionalAccessError failure={error} destination={workspace.destination} onRetry={workspace.retry} /> : memberships === null || !organizationId ? <ProfessionalSkeleton title="Checking resource access" variant="content" /> : <>
      <p className="mb-4 break-words text-xs leading-6 text-muted-foreground">Active organization: {activeMembership?.organization?.name ?? "Your organization"}. Follow your organization&apos;s procedures alongside this directory.</p>
      <ProfessionalCrisisSupport key={organizationId} showDirectoryLink={false} />
    </>}
  </ProfessionalShell>;
}
