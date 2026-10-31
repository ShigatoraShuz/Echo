"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalPanel } from "./professional-ui";
import { professionalAccessDestination, professionalLoginDestination, type ProfessionalAccessFailure } from "../professional-access-feedback";

export function ProfessionalAccessError({ failure, destination = "/professional", onRetry, busy = false, preview = false, atAccess = false, retryLabel = "Retry" }: {
  failure: ProfessionalAccessFailure; destination?: string; onRetry?: () => void; busy?: boolean; preview?: boolean; atAccess?: boolean; retryLabel?: string;
}) {
  const session = failure.kind === "session" || failure.kind === "reauth";
  const linkStyle = "echo-focus-ring inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary motion-reduce:transition-none";
  return <div role="alert" className="min-w-0">
    <ProfessionalPanel title={failure.title} icon={LockKeyhole}>
      <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{failure.message}</p>
      {preview ? <p className="mt-3 text-xs leading-6 text-muted-foreground">Synthetic preview only. No live access check or account change has occurred.</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {failure.retry && onRetry ? <EchoButton type="button" variant="outline" onClick={onRetry} isLoading={busy} loadingText="Checking access" disabled={preview}>{retryLabel}</EchoButton> : null}
        {atAccess && !session && failure.conceal && !failure.retry && failure.kind !== "mfa_invalid" && onRetry ? <EchoButton type="button" variant="outline" onClick={onRetry} isLoading={busy} loadingText="Checking access" disabled={preview}>Refresh access status</EchoButton> : null}
        {session || (!atAccess && (failure.kind === "mfa" || failure.conceal)) ? preview
          ? <EchoButton type="button" variant="outline" disabled>{session ? "Sign in again" : failure.kind === "mfa" ? "Complete authenticator verification" : "Check professional access"}</EchoButton>
          : <Link className={linkStyle} href={session ? professionalLoginDestination(destination) : professionalAccessDestination(destination)}>{session ? "Sign in again" : failure.kind === "mfa" ? "Complete authenticator verification" : "Check professional access"}</Link> : null}
        {!preview ? <Link href="/dashboard" className={linkStyle}>Return to My ECHO</Link> : null}
        {!preview && atAccess && (failure.kind === "mfa_unavailable" || failure.kind === "mfa_invalid") ? <Link href="/settings/security" className={linkStyle}>Review account security</Link> : null}
      </div>
    </ProfessionalPanel>
  </div>;
}
