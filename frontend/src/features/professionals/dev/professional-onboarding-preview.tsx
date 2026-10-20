"use client";

import { useState } from "react";
import type { Membership } from "@/services/professionals/professional-api";
import type { CredentialReviewPreview } from "../professional-onboarding.model";
import { ProfessionalOnboarding } from "../components/professional-onboarding";
import { ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalNotice } from "../components/professional-ui";
import { EchoButton } from "@/shared/components/ui/echo-button";

const states = { empty: "No application", pending: "Pending approval", approved: "Credential approved", access_approved: "Membership approved", rejected: "Needs attention", expired: "Credential expired", suspended: "Access suspended", loading: "Loading", error: "Error" };
type PreviewState = keyof typeof states;
const membership: Membership = {
  id: "synthetic-membership", organizationId: "fc000000-0000-4000-8000-000000000001",
  organization: { id: "fc000000-0000-4000-8000-000000000001", slug: "synthetic-care", name: "Synthetic Care Organization", description: "Fictional organization", serviceHours: "Sample hours", status: "active" },
  role: "counselor", status: "pending", displayName: "Synthetic Professional", credentialLabel: "Synthetic counseling qualification", credentialExpiresAt: "2099-12-31", accessState: "pending_membership",
};

/** Local preview fixtures only; never imports the professional API client. */
export function ProfessionalOnboardingPreview() {
  const [state, setState] = useState<PreviewState>("pending");
  const sampleMembership: Membership = state === "expired" ? { ...membership, accessState: "credential_expired", credentialExpiresAt: "2020-01-01" }
    : state === "suspended" ? { ...membership, accessState: "suspended_membership", status: "suspended" }
      : state === "access_approved" ? { ...membership, accessState: "active", status: "active" } : membership;
  const review: CredentialReviewPreview = {
    id: "synthetic-review", organizationName: "Synthetic Care Organization", credentialLabel: "Synthetic counseling qualification",
    status: state === "access_approved" ? "approved" : state === "approved" || state === "rejected" || state === "expired" ? state : "pending",
    expiresAt: state === "expired" ? "2020-01-01" : "2099-12-31", submittedAt: "2026-10-12",
    reviewedAt: state === "approved" || state === "rejected" ? "2026-10-13" : null,
    reasonCode: state === "rejected" ? "unable_to_verify" : null,
  };
  return (
    <section id="onboarding" className="mt-10 scroll-mt-32">
      <ProfessionalHeading level="h2" label="Onboarding preview" title="Getting ready for professional care" description="Isolated fictional states for layout and validation QA. No account or application is changed."
        action={<label className="block text-xs font-semibold text-muted-foreground">Onboarding preview state<select className="echo-focus-ring mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={state} onChange={(event) => setState(event.target.value as PreviewState)}>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>} />
      {state === "loading" ? <ProfessionalSkeleton variant="content" title="Checking application status" />
        : state === "error" ? <ProfessionalNotice tone="danger" title="Application status unavailable">Synthetic error only. Nothing was sent or saved.<div className="mt-4"><EchoButton type="button" variant="outline" onClick={() => setState("pending")}>Retry sample state</EchoButton></div></ProfessionalNotice>
          : <ProfessionalOnboarding key={state} preview memberships={state === "empty" ? [] : [sampleMembership]} credentials={state === "empty" ? [] : [review]} />}
    </section>
  );
}
