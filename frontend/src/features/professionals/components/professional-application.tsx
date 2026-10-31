"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { professionalApi, type CredentialReview, type CredentialSubmission, type Membership, type Organization } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { professionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalCredentialCorrection } from "./professional-credential-correction";
import { ProfessionalCredentialForm } from "./professional-credential-form";
import { ProfessionalOnboarding } from "./professional-onboarding";
import { ProfessionalNotice, ProfessionalPanel } from "./professional-ui";

/** Real applicant metadata only; evidence is never retained in application history. */
export function ProfessionalApplication(props: { memberships: Membership[]; userId: string }) {
  return <ScopedProfessionalApplication key={props.userId} {...props} />;
}
function ScopedProfessionalApplication({ memberships, userId }: { memberships: Membership[]; userId: string }) {
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [credentials, setCredentials] = useState<CredentialReview[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cleared, setCleared] = useState(false);
  const generation = useRef(0);
  const submission = useRef(false);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setOrganizations(null); setCredentials(null); setError("");
    try {
      const [orgs, history] = await Promise.all([professionalApi.organizations(), professionalApi.credentials()]);
      if (current !== generation.current) return;
      if (history.credentials.some(item => item.userId !== userId)) throw new Error("SCOPE_MISMATCH");
      setOrganizations(orgs.organizations.filter(item => item.status === "active"));
      // Explicit projection excludes evidence even if a future response adds it.
      setCredentials(history.credentials.map(item => ({ id:item.id, organizationId:item.organizationId, userId:item.userId, role:item.role, credentialLabel:item.credentialLabel, expiresAt:item.expiresAt, status:item.status, reviewStatus:item.reviewStatus, submittedAt:item.submittedAt, reviewedAt:item.reviewedAt, reviewedBy:item.reviewedBy, reasonCode:item.reasonCode })));
    } catch (reason) {
      if (current !== generation.current) return;
      const failure = professionalAccessFailure(reason);
      setOrganizations([]); setCredentials(null);
      setError(failure.conceal ? "Application access could not be confirmed. Recheck sign-in and MFA before continuing." : "Applications could not be loaded. No approval status has been inferred.");
    }
  }, [userId]);
  useEffect(() => {
    const effectScope = generation;
    if (userId) void load();
    const clear = () => { generation.current++; setCleared(true); setOrganizations(null); setCredentials(null); setNotice(""); setError(""); setBusy(false); };
    const hide = () => { if (document.visibilityState === "hidden") clear(); };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    window.addEventListener("echo:professional-access-lost", clear);
    document.addEventListener("visibilitychange", hide);
    return () => { effectScope.current++; window.removeEventListener("echo:sensitive-state-cleared", clear); window.removeEventListener("echo:professional-access-lost", clear); document.removeEventListener("visibilitychange", hide); };
  }, [load, userId]);
  async function submit(input: CredentialSubmission) {
    if (submission.current || busy || cleared || !organizations?.some(item => item.id === input.organizationId)) return false;
    submission.current = true; const current = generation.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await professionalApi.submitCredential(input);
      if (current !== generation.current) return false;
      if (result.credential.userId !== userId || result.credential.organizationId !== input.organizationId || result.credential.status !== "pending") throw new Error("SCOPE_MISMATCH");
      setCredentials(items => [result.credential, ...(items ?? []).filter(item => item.id !== result.credential.id)].slice(0,100));
      setNotice("Application submitted — pending independent review. Membership has not been activated.");
      return true;
    } catch {
      if (current === generation.current) setError("Submission could not be confirmed. Refresh application history before retrying; do not submit a second copy immediately.");
      return false;
    } finally { submission.current = false; if (current === generation.current) setBusy(false); }
  }
  if (cleared || !userId) return <ProfessionalOnboarding memberships={cleared ? [] : memberships} application={<ProfessionalNotice title="Application state cleared">Recheck professional access to load the current account. Evidence drafts are not retained.</ProfessionalNotice>} reviewHistory={<ProfessionalNotice title="Application history unavailable">Account-scoped application access must be confirmed first.</ProfessionalNotice>} />;
  const history = <ProfessionalPanel title="Credential applications" icon={FileCheck2} description="Latest 100 applications. Credential review and membership approval are separate.">
    {credentials === null ? <p role="status" className="text-sm">{error ? "Application history is unavailable." : "Loading application history"}</p> : !credentials.length ? <p className="text-sm">No credential application has been submitted for this account.</p> : <ul className="space-y-4">{credentials.map(item => <li key={item.id} className="rounded-2xl border border-border p-4 text-sm">
      <h3 className="font-semibold">{item.credentialLabel}</h3>
      <p className="mt-1 text-xs">{organizations?.find(org => org.id === item.organizationId)?.name ?? "Organization " + item.organizationId} · {item.role.replaceAll("_"," ")}</p>
      <p className="mt-2 font-semibold">{item.status === "pending" ? "Pending approval" : item.status === "approved" ? "Credential approved — membership approval still required" : item.status === "rejected" ? "Application rejected — submit corrected evidence for a new review" : "Credential expired — submit current evidence"}</p>
      {item.reasonCode ? <p className="mt-1 text-xs">Review reason: {item.reasonCode.replaceAll("_"," ")}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">Expiry: {item.expiresAt} · Submitted: {item.submittedAt.slice(0,10)}</p>
      <ProfessionalCredentialCorrection credential={item} onSaved={() => void load()} />
    </li>)}</ul>}
    <p className="mt-3 text-xs leading-6 text-muted-foreground">Request changes is not a separate credential state. A rejection requires a new independently reviewed submission.</p>
  </ProfessionalPanel>;
  return <>
    {error ? <div role="alert" className="mb-4 rounded-2xl border border-danger/30 p-4 text-sm">{error}<EchoButton variant="outline" className="mt-3" disabled={busy} onClick={() => void load()}>Refresh application history</EchoButton></div> : null}
    {notice ? <p role="status" className="mb-4 text-sm font-semibold text-primary">{notice}</p> : null}
    <ProfessionalOnboarding memberships={memberships} reviewHistory={history} application={organizations === null ? <ProfessionalNotice title="Loading application options">Checking available organizations and your application history.</ProfessionalNotice> : error ? <ProfessionalNotice title="Application unavailable">Refresh your application history before submitting.</ProfessionalNotice> : !organizations.length ? <ProfessionalNotice title="No available organizations">An authorized administrator must activate an organization before you can apply.</ProfessionalNotice> : <ProfessionalCredentialForm organizations={organizations} onSubmit={submit} busy={busy} />} />
  </>;
}
