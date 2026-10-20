"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { professionalApi, type PractitionerProfile, type QueueRequest } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalPanel } from "./professional-ui";

/** Assignment uses public practitioner metadata, never case contents. */
export function ProfessionalAssignmentPanel({ organizationId, requests, busy, onAssign }: {
  organizationId: string; requests: QueueRequest[]; busy: boolean;
  onAssign: (requestId: string, profileId: string) => Promise<boolean>;
}) {
  const id = useId();
  const [profiles, setProfiles] = useState<PractitionerProfile[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [requestId, setRequestId] = useState("");
  const [profileId, setProfileId] = useState("");
  const pending = useRef(false);
  const candidates = requests.filter((item) => item.organizationId === organizationId && item.status === "submitted" && !item.assignedTo);
  const hasCandidates = candidates.length > 0;
  useEffect(() => {
    let active = true;
    if (!hasCandidates) return;
    void professionalApi.directory({ organizationId, limit: 30 }).then((result) => {
      if (active) setProfiles(result.practitioners.filter((profile) => profile.organizationId === organizationId && ["counselor", "psychologist", "social_worker"].includes(profile.role)));
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [organizationId, hasCandidates, attempt]);
  if (!hasCandidates) return null;
  return <div className="mb-6"><ProfessionalPanel title="Assign a practitioner" icon={UserRoundCheck} description="Coordinate an unassigned request within this organization. Assignment does not grant you access to clinical case details.">
    {error ? <div role="alert" className="text-sm">Practitioner choices could not be loaded.<EchoButton variant="outline" className="ml-2 min-h-11" onClick={() => { setError(false); setProfiles(null); setAttempt((value) => value + 1); }}>Retry practitioner choices</EchoButton></div> : profiles === null ? <p role="status" className="text-sm text-muted-foreground">Loading practitioner choices</p> : !profiles.length ? <p className="text-sm text-muted-foreground">No eligible practitioners are available in this directory page.</p> : <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      if (pending.current || busy || !candidates.some((item) => item.id === requestId) || !profiles.some((item) => item.id === profileId)) return;
      pending.current = true;
      void onAssign(requestId, profileId).finally(() => { pending.current = false; });
    }}>
      <div><label htmlFor={`${id}-request`} className="text-sm font-semibold">Unassigned request</label><select id={`${id}-request`} className="echo-input mt-2 min-h-11 w-full" value={requestId} disabled={busy} onChange={(event) => setRequestId(event.target.value)} required><option value="">Choose a request</option>{candidates.map((item) => <option key={item.id} value={item.id}>Request {item.id.slice(0, 8).toUpperCase()}</option>)}</select></div>
      <div><label htmlFor={`${id}-profile`} className="text-sm font-semibold">Practitioner</label><select id={`${id}-profile`} className="echo-input mt-2 min-h-11 w-full" value={profileId} disabled={busy} onChange={(event) => setProfileId(event.target.value)} required><option value="">Choose a practitioner</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.role}</option>)}</select></div>
      <EchoButton type="submit" className="min-h-11 sm:col-span-2" disabled={busy || !requestId || !profileId} isLoading={busy} loadingText="Assigning practitioner">Confirm assignment</EchoButton>
    </form>}
  </ProfessionalPanel></div>;
}
