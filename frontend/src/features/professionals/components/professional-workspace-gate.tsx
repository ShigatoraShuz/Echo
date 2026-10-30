"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { professionalApi } from "@/services/professionals/professional-api";
import { ProfessionalShell, ProfessionalSkeleton } from "./professional-shell";
import { professionalReturnPath } from "../professional-return-path";
import { approvedOrganizations } from "../professional-organizations";
import { membershipAccessFailure, professionalAccessDestination, professionalAccessFailure, professionalAccessState, professionalLoginDestination, type ProfessionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalAccessError } from "./professional-access-error";
import { ProfessionalAccessContext, ProfessionalRevalidateContext, type ProfessionalAccess } from "../professional-access-context";
import { ProfessionalReadScope } from "../hooks/professional-read-scope";
export { ProfessionalAccessContext } from "../professional-access-context";

export function ProfessionalWorkspaceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const destination = professionalReturnPath(`${pathname}${query ? `?${query}` : ""}`);
  // Persist only within this mounted authenticated organization. Clinical reads
  // still authorize independently; an organization change destroys every child.
  return <WorkspaceCheck key={searchParams.get("organization") ?? ""} destination={destination}>{children}</WorkspaceCheck>;
}

function WorkspaceCheck({ children, destination }: { children: ReactNode; destination: string }) {
  const router = useRouter();
  const [access, setAccess] = useState<ProfessionalAccess | null>(null);
  const pendingCheck = useRef<Promise<ProfessionalAccess> | null>(null);
  const [error, setError] = useState<ProfessionalAccessFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const verifiedAt = useRef(0);
  const blocked = useRef(false);
  const target = useRef(destination);
  const displayedDestination = useRef(destination);
  target.current = destination;
  const check = useCallback(async (conceal = true) => {
    const current = ++request.current;
    if (conceal) setAccess(null);
    setError(null);
    setBusy(true);
    try {
      // Coalesce pending checks, including Strict Mode replay. A settled result
      // belongs only to this mounted, bounded organization gate.
      if (!pendingCheck.current) {
        const read = professionalApi.memberships();
        pendingCheck.current = read;
        void read.finally(() => { if (pendingCheck.current === read) pendingCheck.current = null; }).catch(() => {});
      }
      const result = await pendingCheck.current;
      if (current !== request.current) return;
      const selected = new URLSearchParams(target.current.split("?")[1]).get("organization");
      const approved = approvedOrganizations(result.memberships);
      if (result.mfaRequired || approved.length === 0 || selected && result.memberships.some(item => item.organizationId === selected) && !approved.some(item => item.organizationId === selected)) {
        blocked.current = true;
        setAccess(null);
        setError(result.mfaRequired && approvedOrganizations(result.memberships).length ? professionalAccessState("mfa") : membershipAccessFailure(result.memberships));
        router.replace(professionalAccessDestination(target.current));
        return;
      }
      verifiedAt.current = Date.now();
      blocked.current = false;
      setAccess(previous => JSON.stringify(previous) === JSON.stringify(result) ? previous : result);
    } catch (reason) {
      if (current !== request.current) return;
      const failure = professionalAccessFailure(reason);
      blocked.current = true;
      setAccess(null);
      setError(failure);
      if (failure.kind === "session" || failure.kind === "reauth") router.replace(professionalLoginDestination(target.current));
      else if (failure.kind === "mfa") router.replace(professionalAccessDestination(target.current));
    } finally {
      if (current === request.current) setBusy(false);
    }
  }, [router]);

  useEffect(() => { void check(); return () => { request.current += 1; }; }, [check]);
  useEffect(() => {
    // A short UI gate lease, never a backend authorization cache. Expired leases
    // conceal children while checking; focus and visible polling also revalidate.
    if (!blocked.current && Date.now() - verifiedAt.current >= 15_000) void check();
  }, [destination, check]);
  useEffect(() => {
    let last = 0;
    const revalidate = () => {
      if (blocked.current || document.visibilityState === "hidden" || Date.now() - last < 1000) return;
      last = Date.now();
      void check(false);
    };
    const timer = window.setInterval(revalidate, 30_000);
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", revalidate); document.removeEventListener("visibilitychange", revalidate); };
  }, [check]);
  useEffect(() => {
    const clear = () => {
      blocked.current = true;
      request.current += 1;
      pendingCheck.current = null;
      setAccess(null);
      setError(professionalAccessState("session"));
    };
    const accessLost = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind !== "session" && kind !== "mfa" && kind !== "reauth" && kind !== "denied") return;
      blocked.current = true;
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
  const navigationExpired = displayedDestination.current !== destination && Date.now() - verifiedAt.current >= 15_000;
  if (access && !navigationExpired) {
    displayedDestination.current = destination;
    return <ProfessionalAccessContext.Provider value={access}><ProfessionalRevalidateContext.Provider value={check}><ProfessionalReadScope key={JSON.stringify(access)}>{children}</ProfessionalReadScope></ProfessionalRevalidateContext.Provider></ProfessionalAccessContext.Provider>;
  }
  return (
    <ProfessionalShell>
      {error ? <ProfessionalAccessError failure={error} destination={destination} onRetry={() => void check()} busy={busy} /> : <ProfessionalSkeleton title="Checking professional access" />}
    </ProfessionalShell>
  );
}
