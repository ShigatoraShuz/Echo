"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { professionalApi, type Membership } from "@/services/professionals/professional-api";
import {
  prepareReviewerMfa,
  verifyReviewerMfa,
  type ReviewerFactor,
} from "@/services/authentication/reviewer-mfa";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { professionalReturnPath } from "../professional-return-path";

const accessLabels: Record<Membership["accessState"], string> = {
  active: "Approved",
  pending_organization: "Organization review pending",
  suspended_organization: "Organization access suspended",
  pending_membership: "Professional approval pending",
  suspended_membership: "Professional access suspended",
  credential_expired: "Credential renewal required",
};

export function ProfessionalAccessView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = professionalReturnPath(searchParams.get("next"));
  const inFlight = useRef(false);
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [factor, setFactor] = useState<ReviewerFactor | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await professionalApi.memberships();
      setMemberships(result.memberships);
      const active = result.memberships.filter((item) => item.accessState === "active");
      if (active.length === 0) return;
      if (result.mfaRequired) {
        const nextFactor = await prepareReviewerMfa("ECHO professional");
        if (nextFactor) {
          setFactor(nextFactor);
          return;
        }
        const refreshed = await professionalApi.memberships();
        if (refreshed.mfaRequired) throw new Error("MFA session unavailable");
      }
      setFactor(null);
      if (active.length === 1 || next.startsWith("/professional/cases/")) {
        const destination = next === "/professional"
          ? `/professional?organization=${encodeURIComponent(active[0].organizationId)}`
          : next;
        router.replace(destination);
        router.refresh();
      }
    } catch {
      setError("Professional access could not be checked. Please retry.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }, [next, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor || busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyReviewerMfa(factor.id, code);
      setFactor(null);
      setCode("");
      setBusy(false);
      await load();
    } catch {
      setError("The authenticator code could not be verified. Try again.");
      setBusy(false);
    }
  }

  const active = memberships?.filter((item) => item.accessState === "active") ?? [];
  return (
    <ProfessionalShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">ECHO professional care</p>
          <h1 className="mt-2 text-3xl [font-family:var(--font-echo-display)]">Professional access</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your ECHO account needs an approved organization, professional role, and authenticator verification.
          </p>
        </div>
        {memberships === null && busy ? <ProfessionalSkeleton title="Checking professional access" /> : null}
        {error ? (
          <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm">
            {error} <button type="button" className="font-semibold underline" onClick={() => void load()}>Retry</button>
          </div>
        ) : null}
        {memberships && active.length === 0 ? (
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <ShieldCheck size={28} className="text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-2xl [font-family:var(--font-echo-display)]">Access is not active yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              An ECHO administrator must approve your organization and role. A verified user account alone does not grant case access.
            </p>
            {memberships.length > 0 ? (
              <ul className="mt-5 space-y-2">
                {memberships.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
                    <span>{item.organization?.name ?? "Organization unavailable"}</span>
                    <strong>{accessLabels[item.accessState]}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-primary underline">Return to My ECHO</Link>
          </section>
        ) : null}
        {factor && active.length > 0 ? (
          <form onSubmit={(event) => void verify(event)} className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-2xl [font-family:var(--font-echo-display)]">Verify your authenticator</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {factor.qrCode ? "Scan this code with your authenticator app, then enter its six-digit code." : "Enter the six-digit code from your authenticator app."}
            </p>
            {factor.qrCode ? <Image src={factor.qrCode} alt="Authenticator enrollment QR code" width={200} height={200} unoptimized /> : null}
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
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-2xl [font-family:var(--font-echo-display)]">Choose an organization</h2>
            <div className="mt-4 grid gap-3">
              {active.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="min-h-14 rounded-xl border border-border px-4 text-left text-sm font-semibold transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => { router.replace(`/professional?organization=${encodeURIComponent(item.organizationId)}`); router.refresh(); }}
                >
                  {item.organization?.name ?? "Organization"} <span className="ml-2 text-muted-foreground">{item.role.replace("_", " ")}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ProfessionalShell>
  );
}
