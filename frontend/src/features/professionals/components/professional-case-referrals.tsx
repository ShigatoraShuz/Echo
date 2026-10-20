"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { HeartHandshake } from "lucide-react";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { referralValidation, safeReferralUrl, type ReferralInput } from "../professional-referrals.model";
import { requestDate } from "../professional-request.model";
import { ProfessionalPanel } from "./professional-ui";

export function ProfessionalCaseReferrals({ referrals, onCreate, readOnly = false, busy = false, disabled = false, error = "", preview = false, children }: {
  referrals: CaseDetail["referrals"]; onCreate?: (input: ReferralInput) => Promise<void>; readOnly?: boolean; busy?: boolean; disabled?: boolean; error?: string; preview?: boolean; children?: React.ReactNode;
}) {
  const id = useId(); const sending = useRef(false);
  const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [validation, setValidation] = useState({ name: "", url: "" });
  async function submit() {
    if (sending.current || busy || disabled || readOnly || preview || !onCreate) return;
    const errors = referralValidation(name, url); setValidation(errors); if (errors.name || errors.url) return;
    sending.current = true;
    try { await onCreate({ resourceName: name.trim(), resourceUrl: url.trim() || null }); } finally { sending.current = false; }
  }
  return <ProfessionalPanel title="Referrals" icon={HeartHandshake} description={preview ? "Synthetic referral records only. No external service is contacted." : "Resources recorded for this authorized case. Recording does not contact an external service."}>
    <ul className="space-y-3">{[...referrals].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).map((item) => {
      const href = safeReferralUrl(item.resourceUrl);
      return <li key={item.id} className="break-words rounded-xl border border-border/70 bg-background p-3 text-sm">
        {href && !preview ? <a href={href} target="_blank" rel="noopener noreferrer" className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg font-semibold text-primary underline">{item.resourceName}<span className="sr-only"> (opens in a new tab)</span></a> : <p className="font-semibold">{item.resourceName}</p>}
        <p className="mt-2 text-xs leading-6 text-muted-foreground">Recorded {requestDate(item.createdAt)}</p>
        {item.resourceUrl && !href ? <p className="mt-1 text-xs text-muted-foreground">A secure resource link is unavailable.</p> : null}
      </li>;
    })}</ul>
    {!referrals.length ? <p className="text-sm text-muted-foreground">No referrals recorded for this case.</p> : null}
    <p className="mt-4 text-xs leading-6 text-muted-foreground">Delivery, acceptance and referral status history are not supplied by this service.</p>
    {preview ? <p className="mt-3 text-xs text-muted-foreground">Resource links and recording are inactive in this preview.</p> : <Link href="/support/find-help" className="echo-focus-ring mt-3 inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary underline">Browse Echo support resources</Link>}
    {children}
    {!readOnly ? <form noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-5 border-t border-border/70 pt-5">
      <fieldset disabled={busy || disabled} className="space-y-4"><legend className="mb-3 text-sm font-semibold">Record a referral</legend>
        <div><label htmlFor={`${id}-name`} className="text-xs font-semibold">Resource name</label><input id={`${id}-name`} required maxLength={160} value={name} onChange={(event) => { setName(event.target.value); setValidation((current) => ({ ...current, name: "" })); }} className="echo-input mt-1 min-h-11" aria-invalid={!!validation.name} aria-describedby={validation.name ? `${id}-name-error` : undefined} />{validation.name ? <p id={`${id}-name-error`} role="alert" className="mt-2 text-xs text-danger">{validation.name}</p> : null}</div>
        <div><label htmlFor={`${id}-url`} className="text-xs font-semibold">Secure website, optional</label><input id={`${id}-url`} type="url" value={url} onChange={(event) => { setUrl(event.target.value); setValidation((current) => ({ ...current, url: "" })); }} className="echo-input mt-1 min-h-11" placeholder="https://" aria-invalid={!!validation.url} aria-describedby={validation.url ? `${id}-url-error` : undefined} />{validation.url ? <p id={`${id}-url-error`} role="alert" className="mt-2 text-xs text-danger">{validation.url}</p> : null}</div>
        <EchoButton type="submit" variant="outline" className="w-full" disabled={preview || disabled || !onCreate} isLoading={busy} loadingText="Recording">Record referral</EchoButton>
      </fieldset>
      {busy ? <p role="status" className="mt-3 text-xs text-muted-foreground">Recording referral. Wait for confirmation before leaving.</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
    </form> : <p className="mt-3 text-xs text-muted-foreground">This case is read-only; new referrals are unavailable.</p>}
    <EchoButton variant="outline" size="small" className="mt-4" disabled>Referral status updates unavailable</EchoButton>
  </ProfessionalPanel>;
}
