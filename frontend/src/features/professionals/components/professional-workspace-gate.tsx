"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { professionalApi } from "@/services/professionals/professional-api";
import { ProfessionalShell, ProfessionalSkeleton } from "./professional-shell";
import { professionalReturnPath } from "../professional-return-path";
import { approvedOrganizations } from "../professional-organizations";
import { membershipAccessFailure, professionalAccessDestination, professionalAccessFailure, professionalAccessState, professionalLoginDestination, type ProfessionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalAccessError } from "./professional-access-error";
import { ProfessionalAccessContext, type ProfessionalAccess } from "../professional-access-context";
export { ProfessionalAccessContext } from "../professional-access-context";

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
  const [access, setAccess] = useState<ProfessionalAccess | null>(null);
  const pendingCheck = useRef<Promise<ProfessionalAccess> | null>(null);
  const [error, setError] = useState<ProfessionalAccessFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const check = useCallback(async () => {
    const current = ++request.current;
    setAccess(null);
    setError(null);
    setBusy(true);
    try {
      // Share only an in-flight read during Strict Mode effect replay. The
      // settled result belongs to this gate and is discarded on navigation.
      const result = await (pendingCheck.current ??= professionalApi.memberships().finally(() => { pendingCheck.current = null; }));
      if (current !== request.current) return;
      if (result.mfaRequired || approvedOrganizations(result.memberships).length === 0) {
        setError(result.mfaRequired && approvedOrganizations(result.memberships).length ? professionalAccessState("mfa") : membershipAccessFailure(result.memberships));
        router.replace(professionalAccessDestination(destination));
        return;
      }
      setAccess(result);
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
  useEffect(() => {
    const clear = () => {
      request.current += 1;
      pendingCheck.current = null;
      setAccess(null);
      setError(professionalAccessState("session"));
    };
    const accessLost = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind !== "session" && kind !== "mfa" && kind !== "reauth" && kind !== "denied") return;
      request.current += 1;
      pendingCheck.current = null;
      setAccess(null);
      setBusy(false);
      setError(professionalAccessState(kind));
    };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    window.addEventListener("echo:professional-access-lost", accessLost);
    return () => {
      window.removeEventListener("echo:sensitive-state-cleared", clear);
      window.removeEventListener("echo:professional-access-lost", accessLost);
    };
  }, []);
  if (access) return <ProfessionalAccessContext.Provider value={access}>{children}</ProfessionalAccessContext.Provider>;
  return (
    <ProfessionalShell>
      {error ? <ProfessionalAccessError failure={error} destination={destination} onRetry={() => void check()} busy={busy} /> : <ProfessionalSkeleton title="Checking professional access" />}
    </ProfessionalShell>
  );
}
