"use client";

import { useState } from "react";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { ProfessionalHeading } from "../components/professional-ui";
import { professionalAccessState, type ProfessionalAccessKind } from "../professional-access-feedback";

const options: { kind: Exclude<ProfessionalAccessKind, "validation">; label: string }[] = [
  { kind: "session", label: "Signed out / expired session" },
  { kind: "unapproved", label: "No approved membership" },
  { kind: "pending", label: "Pending approval" },
  { kind: "suspended", label: "Suspended membership / organization" },
  { kind: "expired", label: "Expired credential" },
  { kind: "denied", label: "Unauthorized role / organization" },
  { kind: "mfa", label: "MFA required" },
  { kind: "mfa_unavailable", label: "MFA unavailable" },
  { kind: "mfa_invalid", label: "Authenticator code not verified" },
  { kind: "reauth", label: "Fresh sign-in required" },
  { kind: "unavailable", label: "Unavailable resource (404)" },
  { kind: "rate", label: "Rate limited (429)" },
  { kind: "network", label: "Network interrupted" },
  { kind: "server", label: "Service unavailable (5xx)" },
];

/** Presentation only: no session, access request, navigation or mutation. */
export function ProfessionalAccessPreview() {
  const [kind, setKind] = useState(options[0].kind);
  return <section id="access-states" className="mt-10 scroll-mt-32 space-y-5">
    <ProfessionalHeading level="h2" title="Protected navigation states" label="Synthetic access preview" description="Select a fictional state to inspect messaging and recovery controls. This does not change your account or grant access." />
    <label className="block max-w-lg text-sm font-semibold">
      Preview access state
      <select className="echo-input mt-2 min-h-11" value={kind} onChange={(event) => {
        const option = options.find((item) => item.kind === event.target.value);
        if (option) setKind(option.kind);
      }}>{options.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select>
    </label>
    <ProfessionalAccessError failure={professionalAccessState(kind)} preview onRetry={() => undefined} />
  </section>;
}
