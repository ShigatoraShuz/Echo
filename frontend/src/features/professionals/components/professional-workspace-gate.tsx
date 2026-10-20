"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { professionalApi } from "@/services/professionals/professional-api";
import { ProfessionalShell, ProfessionalSkeleton } from "./professional-shell";
import { professionalReturnPath } from "../professional-return-path";
import { approvedOrganizations } from "../professional-organizations";
import { membershipAccessFailure, professionalAccessDestination, professionalAccessFailure, professionalAccessState, professionalLoginDestination, type ProfessionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalAccessError } from "./professional-access-error";

export function ProfessionalWorkspaceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const destination = professionalReturnPath(`${pathname}${query ? `?${query}` : ""}`);
  // A new path/organization never reuses the previous route's ready state.
  return <WorkspaceCheck key={destination} destination={destination}>{children}</WorkspaceCheck>;
}

function WorkspaceCheck({ children, destination }: { children: ReactNode; destination: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ProfessionalAccessFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const check = useCallback(async () => {
    const current = ++request.current;
    setReady(false);
    setError(null);
    setBusy(true);
    try {
      const result = await professionalApi.memberships();
      if (current !== request.current) return;
      if (result.mfaRequired || approvedOrganizations(result.memberships).length === 0) {
        setError(result.mfaRequired && approvedOrganizations(result.memberships).length ? professionalAccessState("mfa") : membershipAccessFailure(result.memberships));
        router.replace(professionalAccessDestination(destination));
        return;
      }
      setReady(true);
    } catch (reason) {
      if (current !== request.current) return;
      const failure = professionalAccessFailure(reason);
      setError(failure);
      if (failure.kind === "session" || failure.kind === "reauth") router.replace(professionalLoginDestination(destination));
      else if (failure.kind === "mfa") router.replace(professionalAccessDestination(destination));
    } finally {
      if (current === request.current) setBusy(false);
    }
  }, [destination, router]);

  useEffect(() => { void check(); return () => { request.current += 1; }; }, [check]);
  if (ready) return children;
  return (
    <ProfessionalShell>
      {error ? <ProfessionalAccessError failure={error} destination={destination} onRetry={() => void check()} busy={busy} /> : <ProfessionalSkeleton title="Checking professional access" />}
    </ProfessionalShell>
  );
}
