"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { experienceApi, type SupportResource } from "@/services/experience/experience-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { safeReferralUrl } from "../professional-referrals.model";
import { professionalAccessFailure, type ProfessionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalPanel } from "./professional-ui";

export function reviewedCrisisResources(items: SupportResource[], now = Date.now()) {
  return items.filter((item) => item.type === "crisis_hotline" && item.countryCode === "PH" && safeReferralUrl(item.verificationSource ?? null) && Number.isFinite(Date.parse(item.lastVerifiedAt)) && Date.parse(item.lastVerifiedAt) <= now);
}
export interface CrisisPreview { state: "ready" | "loading" | "empty" | "denied" | "network" | "server" }

function CrisisPresentation({ resources, failure, onRetry, preview, showDirectoryLink = true }: {
  resources: SupportResource[] | null; failure: ProfessionalAccessFailure | null; onRetry?: () => void; preview?: CrisisPreview; showDirectoryLink?: boolean;
}) {
  return <ProfessionalPanel title="Crisis support" icon={ShieldCheck} description="Urgent support information, separate from routine appointments and follow-ups.">
    <p className="text-sm font-semibold leading-7">If someone may be in immediate danger, contact local emergency services and follow your organization&apos;s emergency procedure.</p>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">ECHO is not an emergency service and does not continuously monitor cases. Recording a note, referral or appointment does not alert emergency responders.</p>
    <div className="mt-4 flex flex-wrap gap-3"><EchoButton variant="outline" size="small" disabled aria-describedby="professional-escalation-limit">Escalation unavailable</EchoButton><p id="professional-escalation-limit" className="text-xs leading-6 text-muted-foreground">No professional escalation or dispatch service is connected.</p></div>
    <h3 className="mt-6 text-sm font-semibold">Reviewed Philippine crisis resources</h3>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">Confirm that the service covers the person&apos;s location. Published details do not guarantee availability or a response time.</p>
    {preview ? <p className="mt-3 text-xs font-semibold text-primary">Synthetic crisis interface example. All contacts and external actions are inactive.</p> : null}
    {failure ? <div role="alert" className="mt-4 rounded-xl border border-border p-4"><p className="text-sm font-semibold">{failure.title}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{failure.message}</p>{failure.retry ? <EchoButton variant="outline" size="small" className="mt-3" disabled={!!preview} onClick={onRetry}>Retry resource directory</EchoButton> : null}</div> : resources === null ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading reviewed crisis resources</p> : !resources.length ? <p role="status" className="mt-4 text-sm leading-7 text-muted-foreground">No reviewed crisis resources are available in this response. Use your organization&apos;s established emergency procedure; do not wait for this directory.</p> : <ul className="mt-4 space-y-4">{resources.map((item) => {
      const source = safeReferralUrl(item.verificationSource ?? null);
      const website = safeReferralUrl(item.websiteUrl);
      const phone = item.phoneNumber && /^[+\d\s().-]+$/.test(item.phoneNumber) ? item.phoneNumber.replace(/[^\d+]/g, "") : null;
      return <li key={item.id} className="min-w-0 break-words rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted-foreground">{item.organizationName}</p><h4 className="mt-1 text-sm font-semibold">{item.name}</h4><p className="mt-2 text-xs leading-6 text-muted-foreground">{item.description}</p>{item.availability ? <p className="mt-2 text-xs leading-6 text-muted-foreground">Published availability: {item.availability}</p> : null}
        {preview ? <span className="mt-3 block text-xs text-muted-foreground">Fictional entry. No phone number or live contact link.</span> : <div className="mt-3 flex flex-wrap gap-3">{phone ? <a className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary underline" href={`tel:${phone}`}>Call {item.phoneNumber}</a> : null}{website ? <a className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary underline" href={website} target="_blank" rel="noopener noreferrer">Service website</a> : null}{source ? <a className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary underline" href={source} target="_blank" rel="noopener noreferrer">Source checked {new Date(item.lastVerifiedAt).toLocaleDateString()}</a> : null}</div>}
      </li>;
    })}</ul>}
    {!preview && showDirectoryLink ? <Link href="/support/find-help" className="echo-focus-ring mt-4 inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary underline">Open Echo&apos;s reviewed support directory</Link> : null}
  </ProfessionalPanel>;
}

function LiveCrisisSupport({ showDirectoryLink }: { showDirectoryLink: boolean }) {
  const [resources, setResources] = useState<SupportResource[] | null>(null);
  const [failure, setFailure] = useState<ProfessionalAccessFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void experienceApi.getSupportResources({ country: "PH", type: "crisis_hotline" }).then((items) => { if (active) setResources(reviewedCrisisResources(items)); }).catch((reason) => { if (active) { setResources([]); setFailure(professionalAccessFailure(reason)); } });
    return () => { active = false; };
  }, [attempt]);
  return <CrisisPresentation resources={resources} failure={failure} showDirectoryLink={showDirectoryLink} onRetry={() => { setResources(null); setFailure(null); setAttempt((value) => value + 1); }} />;
}

export function ProfessionalCrisisSupport({ preview, showDirectoryLink = true }: { preview?: CrisisPreview; showDirectoryLink?: boolean }) {
  if (!preview) return <LiveCrisisSupport showDirectoryLink={showDirectoryLink} />;
  const messages = { denied: ["Directory access unavailable", "The directory cannot be accessed with the current permissions."], network: ["Directory connection interrupted", "The synthetic directory request could not complete."], server: ["Directory temporarily unavailable", "The synthetic service is unavailable. No contact information is displayed."] };
  const state = preview.state;
  const failure: ProfessionalAccessFailure | null = state === "denied" || state === "network" || state === "server" ? { kind: state, title: messages[state][0], message: messages[state][1], retry: state !== "denied", conceal: true } : null;
  const resources: SupportResource[] = state === "ready" ? [{ id: "fictional-crisis-resource", type: "crisis_hotline", countryCode: "PH", regionCode: null, organizationName: "Fictional support organization", name: "Fictional reviewed resource", description: "Synthetic directory entry for interface inspection only.", availability: "Not a real service", phoneNumber: null, smsNumber: null, websiteUrl: null, verificationSource: "https://example.invalid/source", lastVerifiedAt: "2026-01-01T00:00:00Z" }] : [];
  return <CrisisPresentation preview={preview} resources={state === "loading" ? null : resources} failure={failure} />;
}
