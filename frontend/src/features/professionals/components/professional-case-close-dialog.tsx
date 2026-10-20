"use client";

import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { useId, useState } from "react";

export function ProfessionalCaseCloseDialog({ open, onClose, onConfirm, busy = false, blocked = false, preview = false, reasonSupported = false }: {
  open: boolean; onClose: () => void; onConfirm?: (reason?: string) => void; busy?: boolean; blocked?: boolean; preview?: boolean; reasonSupported?: boolean;
}) {
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const invalidReason = reason.trim().length === 1 || reason.trim().length > 2000;
  return <EchoDialog open={open} onClose={onClose} title="Close this case?" description="Review the closure restrictions before confirming." className="[font-family:var(--font-echo-sans)] [&_button[aria-label]]:min-h-11 [&_button[aria-label]]:min-w-11">
    <p className="text-sm leading-7 text-muted-foreground">Closing makes the case read-only for new notes, referrals and appointment offers. It does not revoke sharing. Reopening is not supported.</p>
    {reasonSupported && !preview ? <div className="mt-4">
      <label htmlFor={reasonId} className="text-sm font-semibold">Closure reason (optional)</label>
      <textarea id={reasonId} rows={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} aria-invalid={invalidReason} aria-describedby={`${reasonId}-help`} className="echo-input mt-2" />
      <p id={`${reasonId}-help`} className="mt-2 text-xs leading-6 text-muted-foreground">Use 2–2,000 characters if provided. Stored as an encrypted professional record; avoid unnecessary personal information.</p>
    </div> : <p className="mt-3 text-xs leading-6 text-muted-foreground">A closure reason is not available in this workspace. No reason will be collected or submitted.</p>}
    {blocked ? <p role="alert" className="mt-4 text-sm text-danger">Cancel proposed or confirmed appointments before closing.</p> : null}
    {preview ? <p className="mt-4 text-xs text-muted-foreground">Synthetic preview only. Confirmation is disabled and no case changes occur.</p> : null}
    {busy ? <p role="status" className="mt-4 text-sm text-muted-foreground">Confirming closure. The request continues if you close this dialog.</p> : null}
    <div className="mt-6 flex flex-wrap gap-3">
      <EchoButton type="button" variant="outline" onClick={onClose}>{busy ? "Close dialog" : "Keep case open"}</EchoButton>
      <EchoButton type="button" onClick={() => onConfirm?.(reasonSupported ? reason.trim() || undefined : undefined)} disabled={preview || blocked || invalidReason || !onConfirm} isLoading={busy} loadingText="Closing">Confirm closure</EchoButton>
    </div>
  </EchoDialog>;
}
