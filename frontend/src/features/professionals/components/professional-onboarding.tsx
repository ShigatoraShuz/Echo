"use client";

import { BadgeCheck, Building2, CircleHelp, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import type { Membership } from "@/services/professionals/professional-api";
import type { CredentialReviewPreview } from "../professional-onboarding.model";
import { ProfessionalCredentialForm } from "./professional-credential-form";
import { ProfessionalNotice, ProfessionalPanel } from "./professional-ui";

const accessLabels: Record<Membership["accessState"], string> = {
  active: "Approved", pending_organization: "Organization review pending",
  suspended_organization: "Organization access suspended", pending_membership: "Professional approval pending",
  suspended_membership: "Professional access suspended", credential_expired: "Credential renewal required",
};
const reviewLabels = { pending: "Awaiting review", approved: "Credential approved", rejected: "Evidence needs attention", expired: "Credential expired" };
const reasons = {
  invalid_evidence: "The evidence could not be accepted. A corrected reference needs independent review.",
  expired_credential: "The credential is no longer current. A renewed credential needs independent review.",
  unable_to_verify: "The qualification could not be verified from the supplied reference.",
};
function dateLabel(value: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function StatusBadge({ children, attention = false, approved = false }: { children: React.ReactNode; attention?: boolean; approved?: boolean }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${attention ? "border-warning/30 bg-warning/10 text-warning" : approved ? "border-success/30 bg-success/10 text-success" : "border-primary/20 bg-secondary/60 text-primary"}`}><span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />{children}</span>;
}

/** No authorization decisions or API calls. Real memberships are supplied by the access gateway. */
export function ProfessionalOnboarding({ memberships, preview = false, credentials }: {
  memberships: Membership[]; preview?: boolean; credentials?: CredentialReviewPreview[];
}) {
  const approved = memberships.some((item) => item.accessState === "active");
  return (
    <div className="space-y-6">
      <ProfessionalPanel title={approved ? "Membership approved" : "Access is not active yet"} icon={approved ? BadgeCheck : ShieldCheck}
        description={approved ? "Approved membership is one step. Workspace access still requires authenticator verification." : "An ECHO administrator must approve your organization and role. Signing in alone does not grant case access."}>
        <ol className="grid gap-3 sm:grid-cols-3" aria-label="Professional onboarding steps">
          {[
            { title: "Credential evidence", detail: "A reference to your qualification." },
            { title: "Independent review", detail: "An authorized reviewer checks it." },
            { title: "Workspace access", detail: "Approved membership and MFA." },
          ].map((step, index) => <li key={step.title} className="rounded-2xl border border-border/70 bg-background p-4"><span className="mb-3 grid size-8 place-items-center rounded-xl bg-secondary text-xs font-semibold text-primary" aria-hidden="true">{index + 1}</span><p className="text-sm font-semibold">{step.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p></li>)}
        </ol>
      </ProfessionalPanel>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <ProfessionalPanel title="Application status" icon={Building2} description="Organization and role access reported by ECHO.">
            {memberships.length ? <ul className="space-y-4">{memberships.map((item) => (
              <li key={item.id} className="rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{item.organization?.name ?? "Organization unavailable"}</h3><p className="mt-1 text-xs capitalize leading-5 text-muted-foreground">{item.role.replaceAll("_", " ")}</p></div>
                  <StatusBadge approved={item.accessState === "active"} attention={item.accessState.startsWith("suspended") || item.accessState === "credential_expired"}>{accessLabels[item.accessState]}</StatusBadge>
                </div>
                <dl className="mt-4 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Qualification</dt><dd className="mt-1 break-words text-sm">{item.credentialLabel ?? "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Credential expiry</dt><dd className="mt-1 text-sm">{dateLabel(item.credentialExpiresAt)}</dd></div>
                </dl>
                {item.accessState !== "active" ? <p className="mt-4 text-xs leading-6 text-muted-foreground">{item.accessState === "credential_expired" ? "A current credential and administrator reapproval are needed before case access resumes." : item.accessState.startsWith("suspended") ? "Contact your organization or ECHO administrator about reinstatement. Signing in again does not restore suspended access." : "Approval is still required. You can check again after your organization or ECHO administrator reviews access."}</p> : null}
              </li>
            ))}</ul> : <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-7"><CircleHelp size={24} className="text-primary" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold">No professional membership yet</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">No organization or professional role is linked to this account. Ask your organization or ECHO administrator about the approval process.</p></div>}
          </ProfessionalPanel>
          {!approved || preview ? <ProfessionalCredentialForm preview={preview} organizations={preview ? [{ id: "fc000000-0000-4000-8000-000000000001", name: "Synthetic Care Organization" }] : []} /> : null}
        </div>
        <div className="min-w-0 space-y-6">
          <ProfessionalPanel title="What happens next" icon={Clock3}>
            <p className="text-sm leading-7 text-muted-foreground">Credential review and organization membership are separate decisions. An approved credential does not automatically activate your professional role.</p>
            <div className="mt-5 rounded-2xl bg-secondary/60 p-4 text-xs leading-6 text-muted-foreground">Keep your qualification current. Access is checked again when you enter the workspace; only an authorized administrator can approve membership.</div>
          </ProfessionalPanel>
          {preview && credentials ? <ProfessionalPanel title="Synthetic credential review" icon={FileCheck2} description="Preview fixtures only. These are not your account's review records.">
            {credentials.length ? <ul className="space-y-5">{credentials.map((credential) => <li key={credential.id} className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
              <StatusBadge approved={credential.status === "approved"} attention={credential.status === "rejected" || credential.status === "expired"}>{reviewLabels[credential.status]}</StatusBadge>
              <h3 className="break-words text-sm font-semibold">{credential.credentialLabel}</h3><p className="break-words text-xs leading-5 text-muted-foreground">{credential.organizationName}</p>
              <dl className="space-y-3 text-xs"><div><dt className="text-muted-foreground">Submitted</dt><dd className="mt-1">{dateLabel(credential.submittedAt)}</dd></div><div><dt className="text-muted-foreground">Expires</dt><dd className="mt-1">{dateLabel(credential.expiresAt)}</dd></div>{credential.reviewedAt ? <div><dt className="text-muted-foreground">Reviewed</dt><dd className="mt-1">{dateLabel(credential.reviewedAt)}</dd></div> : null}</dl>
              {credential.reasonCode ? <p className="text-xs leading-6 text-muted-foreground">{reasons[credential.reasonCode]}</p> : null}
              {credential.status === "approved" ? <p className="text-xs leading-6 text-muted-foreground">Membership approval and MFA are still required.</p> : null}
            </li>)}</ul> : <p className="text-sm leading-6 text-muted-foreground">No sample credential application yet.</p>}
          </ProfessionalPanel> : <ProfessionalNotice title="Credential review status unavailable">Credential review integration is awaiting deployment. No credential history has been loaded or inferred from your membership status.</ProfessionalNotice>}
        </div>
      </div>
    </div>
  );
}
