"use client";

import { useWorkspaceRefresh } from "@/shared/hooks/use-workspace-refresh";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { professionalApi, type Membership, type ProfessionalDashboardSummary, type QueueRequest } from "@/services/professionals/professional-api";
import { AppError } from "@/shared/errors/app-error";
import { approvedOrganizations } from "../professional-organizations";
import { membershipAccessFailure, professionalAccessDestination, professionalAccessFailure, professionalAccessState, professionalLoginDestination, type ProfessionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalAccessContext } from "../professional-access-context";
import { isPendingRequest, professionalDashboardOverview } from "../professional-dashboard.model";
import { professionalClaimFailure, scopedRequestMetadata } from "../professional-request.model";

/** Shared real workspace lifecycle; presentation and synthetic previews never grant access. */
export function useProfessionalWorkspace(basePath = "/professional", data: "queue" | "schedule" | "none" = "queue") {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedOrganization = searchParams.get("organization");
  const query = searchParams.toString();
  const destination = `${basePath}${query ? `?${query}` : ""}`;
  const gateAccess = useContext(ProfessionalAccessContext);
  const initialOrganizations = approvedOrganizations(gateAccess?.memberships ?? []);
  const initialSelection = initialOrganizations.find((item) => item.organizationId === requestedOrganization) ?? initialOrganizations[0];
  const [memberships, setMemberships] = useState<Membership[] | null>(gateAccess?.memberships ?? null);
  const [userId, setUserId] = useState(gateAccess?.userId ?? "");
  const [organizationId, setOrganizationId] = useState(initialSelection?.organizationId ?? "");
  const [requests, setRequests] = useState<QueueRequest[] | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<ProfessionalDashboardSummary | null>(null);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [error, setError] = useState<ProfessionalAccessFailure | null>(null);
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState("");
  const [membershipAttempt, setMembershipAttempt] = useState(0);
  const [selectionNotice, setSelectionNotice] = useState(requestedOrganization && initialSelection && initialSelection.organizationId !== requestedOrganization ? "That organization is unavailable. Showing your approved organization instead." : "");
  const queueRequest = useRef(0);
  const scope = useRef(0);
  const claimInFlight = useRef(false);
  const pendingReads = useRef(new Map<string, Promise<unknown>>());
  const readOnce = useCallback(<T,>(key: string, load: () => Promise<T>): Promise<T> => {
    const existing = pendingReads.current.get(key);
    if (existing) return existing as Promise<T>;
    const read = Promise.resolve().then(load);
    pendingReads.current.set(key, read);
    const clear = () => { if (pendingReads.current.get(key) === read) pendingReads.current.delete(key); };
    void read.then(clear, clear);
    return read;
  }, []);

  const reportFailure = useCallback((reason: unknown, claiming = false) => {
    const failure = claiming ? professionalClaimFailure(reason) : professionalAccessFailure(reason);
    setSuccess("");
    setError(failure.kind === "validation" ? { ...failure, retry: true } : failure);
    if (failure.kind === "session" || failure.kind === "reauth") router.replace(professionalLoginDestination(destination));
    else if (failure.kind === "mfa") router.replace(professionalAccessDestination(destination));
  }, [destination, router]);

  useEffect(() => {
    let active = true;
    scope.current += 1;
    queueRequest.current += 1;
    // The route gate just verified membership/MFA for this exact navigation.
    // Explicit refresh still revalidates; no result survives a gate unmount.
    if (gateAccess && membershipAttempt === 0) {
      return () => { active = false; scope.current += 1; queueRequest.current += 1; };
    }
    setMemberships(null); setOrganizationId(""); setRequests(null);
    setDashboardSummary(null); setSummaryUnavailable(false);
    setSuccess(""); setBusyId(""); setError(null); setSelectionNotice("");
    readOnce("memberships", () => professionalApi.memberships()).then(({ memberships: items, userId: actor, mfaRequired }) => {
      if (!active) return;
      setMemberships(items); setUserId(actor);
      if (mfaRequired) {
        setError(professionalAccessState("mfa"));
        router.replace(professionalAccessDestination(destination));
        return;
      }
      const approved = approvedOrganizations(items);
      if (!approved.length) setError(membershipAccessFailure(items));
      const selected = approved.find((item) => item.organizationId === requestedOrganization);
      const first = selected ?? approved[0];
      if (requestedOrganization && !selected && first) setSelectionNotice("That organization is unavailable. Showing your approved organization instead.");
      if (first) setOrganizationId(first.organizationId);
    }).catch((reason) => { if (active) { reportFailure(reason); setMemberships([]); } });
    return () => { active = false; scope.current += 1; queueRequest.current += 1; };
  }, [requestedOrganization, membershipAttempt, router, destination, reportFailure, gateAccess, readOnce]);

  const activeMembership = approvedOrganizations(memberships ?? []).find((item) => item.organizationId === organizationId);
  const canClaim = ["counselor", "psychologist", "social_worker"].includes(activeMembership?.role ?? "");

  const refresh = useCallback(async (silent = false) => {
    if (!organizationId) return false;
    const current = ++queueRequest.current;
    if (!silent) { setError(null); setRequests(null); setSuccess(""); setDashboardSummary(null); setSummaryUnavailable(false); }
    try {
      if (data === "none" || basePath === "/professional/my-cases" && !canClaim) {
        setRequests([]);
        return true;
      }
      if (data === "schedule") {
        // There is no administrative organization-wide scheduling API. Do not
        // request a clinical agenda for a non-clinical membership and hide it.
        // Clinical requests still require backend authorization and assignment.
        if (!canClaim) {
          setRequests([]);
          return true;
        }
        const summary = await readOnce(`dashboard:${userId}:${organizationId}`, () => professionalApi.dashboard(organizationId));
        if (current !== queueRequest.current) return false;
        if (summary.organizationId !== organizationId || summary.userId !== userId) {
          throw new AppError({ code: "AUTHORIZATION_ERROR", statusCode: 403, userMessage: "Schedule scope could not be confirmed." });
        }
        setDashboardSummary(summary);
        setRequests([]);
        return true;
      }
      // Both endpoints independently enforce membership, MFA and organization
      // scope. Start together after the fresh access check; retain only pending
      // reads within this hook to coalesce Strict Mode effect replay.
      const summaryRead = basePath === "/professional"
        ? readOnce(`dashboard:${userId}:${organizationId}`, () => professionalApi.dashboard(organizationId))
          .then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason }))
        : null;
      const result = await readOnce(`queue:${userId}:${organizationId}`, () => professionalApi.queue(organizationId));
      if (current !== queueRequest.current) return false;
      let summary: ProfessionalDashboardSummary | null = null;
      let unavailable = false;
      // Legacy deployments have no page envelope. Keep their bounded overview
      // without waiting for an aggregation endpoint they may not have.
      if (result.page && summaryRead) {
        const summaryResult = await summaryRead;
        if (current !== queueRequest.current) return false;
        if (summaryResult.status === "rejected") {
          if (professionalAccessFailure(summaryResult.reason).conceal) throw summaryResult.reason;
          unavailable = true;
        } else {
          summary = summaryResult.value;
          if (!summary || summary.organizationId !== organizationId || summary.userId !== userId) {
            throw new AppError({ code: "AUTHORIZATION_ERROR", statusCode: 403, userMessage: "Dashboard scope could not be confirmed." });
          }
        }
      }
      if (current === queueRequest.current) {
        setRequests(scopedRequestMetadata(result.requests, organizationId));
        setDashboardSummary(summary); setSummaryUnavailable(unavailable);
        return true;
      }
    } catch (reason) { if (current === queueRequest.current) { reportFailure(reason); setRequests(null); } }
    return false;
  }, [organizationId, reportFailure, basePath, userId, data, canClaim, readOnce]);

  useEffect(() => { void refresh(); return () => { queueRequest.current += 1; }; }, [refresh]);
  useWorkspaceRefresh(() => { if (!claimInFlight.current && !error) void refresh(true); }, data === "schedule" && canClaim ? userId + ":" + organizationId + ":" + activeMembership?.role : "", () => { queueRequest.current++; pendingReads.current.clear(); setRequests(null); setDashboardSummary(null); setOrganizationId(""); });
  const overview = useMemo(() => professionalDashboardOverview(requests ?? [], organizationId, userId), [requests, organizationId, userId]);

  async function claim(id: string) {
    if (claimInFlight.current || busyId || error || !canClaim || !requests?.some((item) => item.id === id && isPendingRequest(item))) return false;
    claimInFlight.current = true;
    const currentScope = scope.current;
    setBusyId(id); setError(null); setSuccess("");
    try {
      await professionalApi.claim(id);
      if (currentScope !== scope.current) return false;
      const updated = await refresh();
      if (updated && currentScope === scope.current) setSuccess("Request accepted. Your overview is up to date.");
      return updated && currentScope === scope.current;
    } catch (reason) {
      if (currentScope === scope.current) { queueRequest.current += 1; setRequests(null); setDashboardSummary(null); reportFailure(reason, true); }
      return false;
    } finally {
      if (currentScope === scope.current) { claimInFlight.current = false; setBusyId(""); }
    }
  }

  const canAssign = ["coordinator", "org_admin"].includes(activeMembership?.role ?? "");
  async function assign(id: string, profileId: string) {
    if (claimInFlight.current || busyId || error || !canAssign || !requests?.some((item) => item.id === id && isPendingRequest(item))) return false;
    claimInFlight.current = true;
    const currentScope = scope.current;
    setBusyId(id); setError(null); setSuccess("");
    try {
      await professionalApi.assign(id, profileId);
      if (currentScope !== scope.current) return false;
      const updated = await refresh();
      if (updated && currentScope === scope.current) setSuccess("Practitioner assignment confirmed. Your overview is up to date.");
      return updated && currentScope === scope.current;
    } catch (reason) {
      if (currentScope === scope.current) { queueRequest.current += 1; setRequests(null); setDashboardSummary(null); reportFailure(reason, true); }
      return false;
    } finally { if (currentScope === scope.current) { claimInFlight.current = false; setBusyId(""); } }
  }

  function refreshWorkspace() {
    if (claimInFlight.current) return;
    scope.current += 1; queueRequest.current += 1; pendingReads.current.clear();
    setRequests(null); setMemberships(null); setOrganizationId(""); setSuccess("");
    setDashboardSummary(null); setSummaryUnavailable(false);
    setMembershipAttempt((attempt) => attempt + 1);
  }
  function switchOrganization(id: string) {
    if (id === organizationId || claimInFlight.current || !approvedOrganizations(memberships ?? []).some((item) => item.organizationId === id)) return;
    scope.current += 1; queueRequest.current += 1; pendingReads.current.clear();
    setRequests(null); setMemberships(null); setOrganizationId(""); setSuccess(""); setError(null);
    setDashboardSummary(null); setSummaryUnavailable(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("organization", id);
    router.replace(`${basePath}?${params.toString()}${window.location.hash}`, { scroll: false });
  }
  function retry() { if (memberships?.length && organizationId) void refresh(); else refreshWorkspace(); }
  return { memberships, userId, organizationId, activeMembership, requests, overview, dashboardSummary, summaryUnavailable, error, success, busyId, canClaim, selectionNotice, destination, refreshWorkspace, switchOrganization, retry, claim, canAssign, assign };
}
