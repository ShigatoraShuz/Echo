"use client";

import type { Appointment } from "@/services/professionals/professional-api";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { appointmentTime } from "../professional-appointments.model";

export function ProfessionalAppointmentCancelDialog({ appointment, onClose, onConfirm, busy = false, preview = false }: {
  appointment: Appointment | null; onClose: () => void; onConfirm?: () => void; busy?: boolean; preview?: boolean;
}) {
  return <EchoDialog open={!!appointment} onClose={onClose} title="Cancel this appointment?" description="Cancellation does not reserve a replacement appointment." className="[font-family:var(--font-echo-sans)] [&_button[aria-label]]:min-h-11 [&_button[aria-label]]:min-w-11">
    <p className="text-sm font-semibold">{appointment ? appointmentTime(appointment.startsAt) : ""}</p>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">The server rechecks your assignment, professional access, authenticator verification and the current appointment state. The request owner alone can accept an appointment proposal.</p>
    {preview ? <p className="mt-3 text-xs text-muted-foreground">Synthetic preview only. Cancellation is disabled.</p> : null}
    {busy ? <p role="status" className="mt-3 text-sm text-muted-foreground">Confirming cancellation. The request continues if you close this dialog.</p> : null}
    <div className="mt-6 flex flex-wrap gap-3"><EchoButton variant="outline" onClick={onClose}>{busy ? "Close dialog" : "Keep appointment"}</EchoButton><EchoButton onClick={onConfirm} disabled={preview || !onConfirm} isLoading={busy} loadingText="Canceling">Confirm cancellation</EchoButton></div>
  </EchoDialog>;
}
