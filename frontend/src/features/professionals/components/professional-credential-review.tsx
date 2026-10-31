"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { professionalApi, type CredentialDecision, type CredentialReview } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { professionalAccessFailure } from "../professional-access-feedback";

const pageIsHidden = () => document.visibilityState === "hidden";

export function ProfessionalCredentialReview(props: { organizationId: string; organizationName: string; active: boolean; onChanged: () => void }) {
  return <ScopedCredentialReview key={props.organizationId} {...props} />;
}
function ScopedCredentialReview({ organizationId, organizationName, active, onChanged }: { organizationId: string; organizationName: string; active: boolean; onChanged: () => void }) {
  const [items, setItems] = useState<CredentialReview[] | null>(null);
  const [actorId, setActorId] = useState("");
  const [detail, setDetail] = useState<(CredentialReview & { evidenceReference: string | null }) | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [reason, setReason] = useState<Exclude<CredentialReview["reasonCode"], null>>("unable_to_verify");
  const generation = useRef(0), pending = useRef(false), evidenceEpoch = useRef(0), evidenceUsable = useRef(false);
  const clearDetail = () => { evidenceUsable.current = false; setReason("unable_to_verify"); setDetail(null); setChecked(false); setMembershipChecked(false); setDisplayName(""); };
  const load = useCallback(async () => {
    const current = ++generation.current;
    setItems(null); setDetail(null); setChecked(false); setMembershipChecked(false); setDisplayName(""); setError("");
    try {
      const [result, actor] = await Promise.all([professionalApi.adminCredentials(organizationId), professionalApi.memberships()]);
      if (current !== generation.current) return;
      if (!actor.userId || actor.mfaRequired || result.credentials.some(item => item.organizationId !== organizationId)) throw new Error("REVIEW_SCOPE_UNAVAILABLE");
      setActorId(actor.userId); setItems(result.credentials);
    } catch (failure) {
      if (current !== generation.current) return;
      setItems([]); setActorId("");
      if (professionalAccessFailure(failure).conceal) setLocked(true);
      setError("Credential applications could not be accessed. An independently authorized verification administrator, MFA and a recent sign-in are required; org_admin membership alone is insufficient.");
    }
  }, [organizationId]);
  useEffect(() => {
    const effectScope = generation;
    void load();
    const clear = () => { generation.current++; evidenceEpoch.current++; evidenceUsable.current = false; setReason("unable_to_verify"); setLocked(true); setItems(null); setActorId(""); setDetail(null); setChecked(false); setMembershipChecked(false); setDisplayName(""); setNotice(""); setError(""); };
    // Window switching is not access loss. Retain only the selected metadata
    // and form progress; discard plaintext and suppress late evidence responses.
    const hide = () => { if (pageIsHidden()) {
      evidenceEpoch.current++; evidenceUsable.current = false;
      setDetail(current => current ? { ...current, evidenceReference: null } : null);
    } };
    window.addEventListener("echo:sensitive-state-cleared", clear); window.addEventListener("echo:professional-access-lost", clear); document.addEventListener("visibilitychange", hide);
    return () => { effectScope.current++; window.removeEventListener("echo:sensitive-state-cleared", clear); window.removeEventListener("echo:professional-access-lost", clear); document.removeEventListener("visibilitychange", hide); };
  }, [load]);
  async function open(item: CredentialReview, preserveDraft = false) {
    if (pending.current || locked || pageIsHidden() || item.organizationId !== organizationId) return;
    pending.current = true; const current = ++generation.current, evidenceScope = evidenceEpoch.current;
    evidenceUsable.current = false;
    if (!preserveDraft) clearDetail();
    setDetail({ ...item, evidenceReference: null }); setBusy(true); setError(""); setNotice("");
    try {
      const result = await professionalApi.adminCredential(organizationId, item.id);
      if (current !== generation.current) return;
      if (result.credential.organizationId !== organizationId || result.credential.id !== item.id || result.credential.userId !== item.userId || typeof result.credential.evidenceReference !== "string") throw new Error("REVIEW_SCOPE_UNAVAILABLE");
      if (preserveDraft && (['userId','role','credentialLabel','expiresAt','status','reviewStatus','reviewedBy','reviewedAt'] as const).some(key => result.credential[key] !== item[key])) {
        setChecked(false); setMembershipChecked(false); setDisplayName("");
      }
      evidenceUsable.current = evidenceScope === evidenceEpoch.current && !pageIsHidden();
      setDetail({ ...result.credential, evidenceReference: evidenceUsable.current ? result.credential.evidenceReference : null });
    } catch (failure) {
      if (current === generation.current) { setError("Protected evidence could not be opened. Recheck reviewer access; no decision can be recorded."); if (professionalAccessFailure(failure).conceal) { setLocked(true); setItems(null); setActorId(""); clearDetail(); } }
    } finally { pending.current = false; if (current === generation.current) setBusy(false); }
  }
  async function decide(decision: CredentialDecision) {
    if (!detail || !evidenceUsable.current || detail.evidenceReference === null || pageIsHidden() || detail.organizationId !== organizationId || detail.userId === actorId || detail.status !== "pending" || !checked || !actorId || locked || pending.current || (decision.decision === "approved" && !active)) return;
    const selected = detail, current = generation.current;
    pending.current = true; setBusy(true); setError(""); clearDetail();
    try {
      await professionalApi.decideCredential(organizationId, selected.id, decision);
      if (current !== generation.current) return;
      setNotice("Review decision saved. Membership has not been activated."); onChanged(); await load();
    } catch (failure) {
      if (current === generation.current) { setError("Decision could not be confirmed. Refresh the application list before retrying; another reviewer may have completed it."); setItems(null); if (professionalAccessFailure(failure).conceal) setLocked(true); }
    } finally { pending.current = false; setBusy(false); }
  }
  async function activate() {
    if (!detail || !evidenceUsable.current || detail.evidenceReference === null || pageIsHidden() || detail.organizationId !== organizationId || detail.userId === actorId || detail.status !== "approved" || detail.expiresAt < new Date().toISOString().slice(0,10) || !active || !membershipChecked || displayName.trim().length < 2 || !actorId || locked || pending.current) return;
    const selected = detail, current = generation.current, name = displayName.trim();
    pending.current = true; setBusy(true); setError(""); clearDetail();
    try {
      await professionalApi.approveMember({ organizationId, userId:selected.userId, role:selected.role, displayName:name, credentialLabel:selected.credentialLabel, credentialExpiresAt:selected.expiresAt, credentialChecked:true, credentialId:selected.id });
      if (current !== generation.current) return;
      setNotice("Professional membership activated using the approved credential review."); onChanged(); await load();
    } catch (failure) {
      if (current === generation.current) { setError("Membership activation could not be confirmed. Refresh access and member status before retrying."); setItems(null); if (professionalAccessFailure(failure).conceal) setLocked(true); }
    } finally { pending.current = false; setBusy(false); }
  }
  const synthetic = detail?.credentialLabel.startsWith("SYNTHETIC THESIS DEMO");
  return <section aria-label="Professional credential applications" className="rounded-3xl border border-border bg-card p-5 shadow-subtle sm:p-7">
    <h2 className="text-2xl [font-family:var(--font-echo-display)]">Professional applications</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{organizationName}. Latest 100 applications. Independent credential review comes before a separate membership activation. These controls do not grant clinical case access to administrators.</p>
    {error ? <p role="alert" className="mt-3 rounded-xl border border-danger/30 p-3 text-sm">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm font-semibold text-primary">{notice}</p> : null}
    {locked ? <p className="mt-3 text-sm">Review state cleared. <Link href="/admin-login" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Sign in as an authorized reviewer</Link>, then reopen Professional access.</p> : <>
      <EchoButton className="mt-3" variant="outline" disabled={busy} onClick={() => void load()}>Refresh applications</EchoButton>
      {items === null ? <p role="status" className="mt-3 text-sm">{error ? "Applications are unavailable." : "Loading applications"}</p> : !items.length ? <p className="mt-3 text-sm">No applications in this organization.</p> : <ul className="mt-3 space-y-3">{items.map(item => <li key={item.id} className="rounded-2xl border border-border p-4 text-sm"><h3 className="font-semibold">{item.credentialLabel}</h3><p className="mt-1 break-all text-xs">Application {item.id}</p><p className="mt-1 break-all text-xs">Applicant {item.userId} · {item.role.replaceAll("_"," ")} · {item.status} · expires {item.expiresAt}</p><EchoButton variant="outline" size="small" className="mt-2" disabled={busy} onClick={() => void open(item)}>Review application</EchoButton></li>)}</ul>}
      {detail ? <div className="mt-4 space-y-4 rounded-2xl border border-primary/25 bg-secondary/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Protected credential evidence</h3><EchoButton variant="outline" size="small" disabled={busy} onClick={clearDetail}>Close evidence</EchoButton></div>
        <p className="break-all text-xs">Applicant {detail.userId} · {detail.role.replaceAll("_"," ")} · {detail.status} · {organizationName}</p>
        {synthetic ? <p className="text-sm font-semibold">Synthetic thesis demonstration reference — not a professional license. Review only against the project owner’s explicitly approved fictional-demo provenance.</p> : null}
        {detail.evidenceReference !== null ? <p className="whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-3 text-sm">{detail.evidenceReference}</p> : <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <p>Protected evidence is hidden. Your selected application and form progress are retained. Reopen evidence to confirm access before continuing.</p>
          <EchoButton variant="outline" size="small" className="mt-2" disabled={busy} onClick={() => void open(detail, true)}>Reopen protected evidence</EchoButton>
        </div>}
        <p className="text-xs leading-6">Evidence access is audited. References are displayed as text and are never fetched or opened automatically.</p>
        {detail.userId === actorId ? <p role="alert" className="text-sm">Another authorized reviewer must review and activate your access. Self-approval is unavailable.</p> : detail.status === "pending" ? <>
          <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />I independently checked this evidence, its subject, organization, role and expiry.</label>
          <label className="block text-sm">Rejection reason<select className="echo-input mt-2" value={reason} onChange={event => setReason(event.target.value as typeof reason)}><option value="unable_to_verify">Unable to verify</option><option value="invalid_evidence">Invalid evidence</option><option value="expired_credential">Expired credential</option></select></label>
          <div className="flex flex-wrap gap-3"><EchoButton disabled={detail.evidenceReference === null || !checked || !active || busy} onClick={() => void decide({decision:"approved",reasonCode:null})}>{synthetic ? "Approve synthetic reference" : "Approve credential"}</EchoButton><EchoButton variant="outline" disabled={detail.evidenceReference === null || !checked || busy} onClick={() => void decide({decision:"rejected",reasonCode:reason})}>Reject application</EchoButton></div>
        </> : detail.status === "approved" ? <>
          <label className="block text-sm">Approved professional display name<input className="echo-input mt-2" value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={120} autoComplete="off" /></label>
          <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" checked={membershipChecked} onChange={event => setMembershipChecked(event.target.checked)} />I checked organization affiliation and authorize this separate membership activation.</label>
          <EchoButton disabled={detail.evidenceReference === null || !active || !membershipChecked || displayName.trim().length < 2 || busy} onClick={() => void activate()}>Activate approved membership</EchoButton>
        </> : <p className="text-sm">Rejected or expired applications cannot activate membership. A new application requires independent review.</p>}
      </div> : null}
    </>}
  </section>;
}
