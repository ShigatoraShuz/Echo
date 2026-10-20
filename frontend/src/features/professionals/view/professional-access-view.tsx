"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { professionalApi, type Membership } from "@/services/professionals/professional-api";
import {
  prepareReviewerMfa,
  verifyReviewerMfa,
  type ReviewerFactor,
} from "@/services/authentication/reviewer-mfa";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { professionalOrganizationDestination, professionalReturnPath } from "../professional-return-path";
import { ProfessionalOnboarding } from "../components/professional-onboarding";
import { ProfessionalHeading, ProfessionalNotice } from "../components/professional-ui";
import { approvedOrganizations } from "../professional-organizations";
import { ProfessionalOrganizationChooser } from "../components/professional-organization-selector";
import { professionalAccessFailure, professionalAccessState, professionalLoginDestination, type ProfessionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { professionalMfaImage } from "../professional-mfa-image";

export function ProfessionalAccessView() {
  const searchParams = useSearchParams();
  const next = professionalReturnPath(searchParams.get("next"));
  return <AccessCheck key={next} next={next} />;
}

function AccessCheck({ next }: { next: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const verificationInFlight = useRef(false);
  const request = useRef(0);
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [factor, setFactor] = useState<ReviewerFactor | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ProfessionalAccessFailure | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = ++request.current;
    setBusy(true);
    setError(null);
    setMemberships(null);
    setFactor(null);
    setCode("");
    let preparingMfa = false;
    try {
      const result = await professionalApi.memberships();
      if (current !== request.current) return;
      setMemberships(result.memberships);
      let active = approvedOrganizations(result.memberships);
      if (active.length === 0) return;
      if (result.mfaRequired) {
        preparingMfa = true;
        const nextFactor = await prepareReviewerMfa("ECHO professional");
        if (current !== request.current) return;
        preparingMfa = false;
        if (nextFactor) {
          setFactor(nextFactor);
          return;
        }
        const refreshed = await professionalApi.memberships();
        if (current !== request.current) return;
        if (refreshed.mfaRequired) { setError(professionalAccessState("mfa_unavailable")); return; }
        setMemberships(refreshed.memberships);
        active = approvedOrganizations(refreshed.memberships);
        if (active.length === 0) return;
      }
      setFactor(null);
      if (active.length === 1 || next.startsWith("/professional/cases/")) {
        const destination = next === "/professional"
          ? `/professional?organization=${encodeURIComponent(active[0].organizationId)}`
          : next;
        router.replace(destination);
        router.refresh();
      }
    } catch (reason) {
      if (current !== request.current) return;
      const failure = preparingMfa ? professionalAccessState("mfa_unavailable") : professionalAccessFailure(reason);
      setError(failure);
      setMemberships(null);
      if (failure.kind === "session" || failure.kind === "reauth") router.replace(professionalLoginDestination(next));
    } finally {
      if (current === request.current) { setBusy(false); inFlight.current = false; }
    }
  }, [next, router]);

  useEffect(() => {
    void load();
    return () => { request.current += 1; inFlight.current = false; };
  }, [load]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor || busy || verificationInFlight.current) return;
    verificationInFlight.current = true;
    const current = request.current;
    setBusy(true);
    setError(null);
    try {
      await verifyReviewerMfa(factor.id, code);
      if (current !== request.current) return;
      setFactor(null);
      setCode("");
      setBusy(false);
      await load();
    } catch {
      if (current !== request.current) return;
      setError(professionalAccessState("mfa_invalid"));
      setBusy(false);
    } finally {
      verificationInFlight.current = false;
    }
  }

  const active = approvedOrganizations(memberships ?? []);
  return (
    <ProfessionalShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <ProfessionalHeading title="Professional access" label="ECHO professional care" description="Your ECHO account needs an approved organization, professional role, and authenticator verification." />
        {memberships === null && busy ? <ProfessionalSkeleton variant="content" title="Checking professional access" /> : null}
        {error ? <ProfessionalAccessError failure={error} destination={next} atAccess onRetry={() => void load()} busy={busy} /> : null}
        {memberships && active.length === 0 ? <ProfessionalOnboarding memberships={memberships} /> : null}
        {active.length > 0 ? <ProfessionalNotice title="Membership approved">{factor ? "Authenticator verification is required before entering your workspace. " : null}Continue through any required authenticator check, then choose your approved organization. Credential review alone does not grant workspace access.</ProfessionalNotice> : null}
        {memberships && active.length === 0 ? <div className="flex flex-wrap items-center gap-3"><EchoButton type="button" variant="outline" isLoading={busy} loadingText="Checking access" onClick={() => void load()}>Check approval status</EchoButton><Link href="/dashboard" className="echo-focus-ring inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary underline">Return to My ECHO</Link></div> : null}
        {factor && active.length > 0 ? (
          <form onSubmit={(event) => void verify(event)} className="mx-auto max-w-2xl space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-2xl [font-family:var(--font-echo-display)]">Verify your authenticator</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {factor.qrCode ? "Scan this code with your authenticator app, then enter its six-digit code." : "Enter the six-digit code from your authenticator app."}
            </p>
            {factor.qrCode ? <Image src={professionalMfaImage(factor.qrCode)} alt="Authenticator enrollment QR code" width={200} height={200} unoptimized /> : null}
            <label className="block text-sm font-semibold">
              Authenticator code
              <input
                className="echo-input mt-2"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
              />
            </label>
            <EchoButton type="submit" isLoading={busy} loadingText="Verifying" disabled={code.length !== 6}>Verify and continue</EchoButton>
          </form>
        ) : null}
        {active.length > 1 && !factor && !busy && !error ? (
          <ProfessionalOrganizationChooser memberships={memberships ?? []} onChange={(id) => {
            if (!active.some((item) => item.organizationId === id)) return;
            router.replace(professionalOrganizationDestination(next, id));
            router.refresh();
          }} />
        ) : null}
      </div>
    </ProfessionalShell>
  );
}
