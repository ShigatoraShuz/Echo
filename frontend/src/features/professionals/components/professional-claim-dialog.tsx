"use client";

import type { QueueRequest } from "@/services/professionals/professional-api";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { EchoButton } from "@/shared/components/ui/echo-button";

export function ProfessionalClaimDialog({ request, organizationName, onClose, onConfirm, busy = false, preview = false, failure = "" }: {
  request: QueueRequest | null; organizationName: string; onClose: () => void; onConfirm?: () => void;
  busy?: boolean; preview?: boolean; failure?: string;
}) {
  return <EchoDialog open={!!request} onClose={onClose} title="Accept this request?" description="Confirm assignment to yourself before opening restricted case details." className="[font-family:var(--font-echo-sans)] [&_button[aria-label]]:min-h-11 [&_button[aria-label]]:min-w-11">
    <p className="break-words text-sm font-semibold text-foreground">{organizationName}</p>
    <p className="mt-2 break-all text-xs leading-6 text-muted-foreground">Request ID: {request?.id}</p>
    <p className="mt-4 text-sm leading-7 text-muted-foreground">The server checks your role, membership, authenticator verification and current availability before assigning this request. Acceptance does not expand the user&apos;s consent.</p>
    {preview ? <p className="mt-4 text-xs leading-6 text-muted-foreground">Synthetic preview only. Confirmation is disabled and no account or assignment changes occur.</p> : null}
    {busy ? <p role="status" className="mt-4 text-sm text-muted-foreground">Confirming acceptance. The request continues if you close this dialog.</p> : null}
    {failure ? <p role="alert" className="mt-4 text-sm text-danger">{failure}</p> : null}
    <div className="mt-6 flex flex-wrap gap-3">
      <EchoButton type="button" variant="outline" onClick={onClose}>{busy ? "Close" : "Cancel"}</EchoButton>
      <EchoButton type="button" onClick={onConfirm} disabled={preview || !onConfirm || !!failure} isLoading={busy} loadingText="Confirming acceptance">Confirm acceptance</EchoButton>
    </div>
  </EchoDialog>;
}
