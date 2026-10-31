"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Appointment } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import {
  appointmentProposal,
  appointmentTime,
  appointmentZone,
  sessionModes,
  validateAppointment,
  type AppointmentDraft,
  type AppointmentProposal,
} from "../professional-appointments.model";

export function ProfessionalAppointmentForm({
  appointments,
  onPropose,
  busy = false,
  disabled = false,
  error = "",
  preview = false,
  rescheduling = false,
  initialAppointment,
}: {
  appointments: Appointment[];
  onPropose?: (input: AppointmentProposal) => Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
  preview?: boolean;
  rescheduling?: boolean;
  initialAppointment?: Appointment;
}) {
  const id = useId();
  const sending = useRef(false);
  const [draft, setDraft] = useState<AppointmentDraft>(() => {
    const local = (instant: string) => {
      const date = new Date(instant);
      if (!Number.isFinite(date.getTime())) return "";
      const pad = (value: number) => String(value).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    return initialAppointment
      ? {
          start: local(initialAppointment.startsAt),
          end: local(initialAppointment.endsAt),
          mode: initialAppointment.mode,
          locationHint: initialAppointment.locationHint,
        }
      : { start: "", end: "", mode: "in_person", locationHint: "" };
  });
  const [validation, setValidation] = useState("");
  const [review, setReview] = useState(false);
  const change = (key: keyof AppointmentDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidation("");
  };
  const message = validation || error;
  const validate = () => {
    const reason = validateAppointment(draft, appointments);
    setValidation(reason);
    return !reason;
  };
  async function confirm() {
    if (sending.current || busy || disabled || preview || !onPropose || !validate()) return;
    sending.current = true;
    setReview(false);
    try {
      await onPropose(appointmentProposal(draft));
    } finally {
      sending.current = false;
    }
  }
  const reviewRegion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (review && rescheduling) reviewRegion.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [review, rescheduling]);
  const confirmation = (
    <>
      {" "}
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Starts</dt>
          <dd>{appointmentTime(draft.start)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ends</dt>
          <dd>{appointmentTime(draft.end)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Session type</dt>
          <dd>{sessionModes[draft.mode as keyof typeof sessionModes]}</dd>
        </div>
      </dl>
      <p className="mt-4 break-words whitespace-pre-wrap text-sm">
        {draft.locationHint.trim() || "No meeting details specified."}
      </p>
      {validation ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {validation}
        </p>
      ) : null}
      {preview ? (
        <p className="mt-3 text-xs text-muted-foreground">Fictional preview. No appointment will be proposed.</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <EchoButton variant="outline" onClick={() => setReview(false)}>
          Keep editing
        </EchoButton>
        <EchoButton onClick={() => void confirm()} disabled={preview || disabled || busy || !onPropose}>
          Send proposal
        </EchoButton>
      </div>
    </>
  );
  return (
    <>
      <form
        hidden={rescheduling && review}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !disabled && validate()) setReview(true);
        }}
        className="mt-6 rounded-2xl border border-border bg-background p-4"
      >
        <h3 className="text-sm font-semibold">
          {rescheduling ? "Propose a replacement appointment" : "Propose an appointment"}
        </h3>
        <p id={`${id}-help`} className="mt-2 text-xs leading-6 text-muted-foreground">
          Times use {appointmentZone()}. Review the UTC offsets before sending, particularly around daylight-saving
          changes. Proposals are not confirmed availability; the server checks current appointments and overlapping
          practitioner bookings.
        </p>
        <fieldset
          disabled={busy || disabled}
          aria-describedby={`${id}-help${message ? ` ${id}-error` : ""}`}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <legend className="sr-only">Appointment proposal details</legend>
          <label className="text-xs font-semibold">
            Starts
            <input
              type="datetime-local"
              required
              value={draft.start}
              onChange={(event) => change("start", event.target.value)}
              className="echo-input mt-1 min-h-11"
            />
          </label>
          <label className="text-xs font-semibold">
            Ends
            <input
              type="datetime-local"
              required
              value={draft.end}
              onChange={(event) => change("end", event.target.value)}
              className="echo-input mt-1 min-h-11"
            />
          </label>
          <label className="text-xs font-semibold">
            Session type
            <select
              value={draft.mode}
              onChange={(event) => change("mode", event.target.value)}
              className="echo-input mt-1 min-h-11"
            >
              {Object.entries(sessionModes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Meeting details, optional
            <input
              maxLength={240}
              value={draft.locationHint}
              onChange={(event) => change("locationHint", event.target.value)}
              placeholder="Room or joining instructions"
              className="echo-input mt-1 min-h-11"
            />
          </label>
          <EchoButton
            type="submit"
            className="sm:col-span-2"
            disabled={busy || disabled}
            isLoading={busy}
            loadingText="Proposing"
          >
            Review appointment proposal
          </EchoButton>
        </fieldset>
        {message ? (
          <p id={`${id}-error`} role="alert" className="mt-3 text-sm text-danger">
            {message}
          </p>
        ) : null}
        {busy ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Sending proposal. Wait for the server to confirm receipt.
          </p>
        ) : null}
        {preview ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Synthetic form only. You can inspect the confirmation; sending is disabled.
          </p>
        ) : null}
      </form>
      {rescheduling && review ? (
        <div ref={reviewRegion} className="mt-5">
          <h3 className="mb-3 text-sm font-semibold">Send this replacement proposal?</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            The previous appointment will be canceled atomically. The student must accept this new time.
          </p>
          {confirmation}
        </div>
      ) : null}
      <EchoDialog
        open={review && !rescheduling}
        onClose={() => setReview(false)}
        title="Send this appointment proposal?"
        description={
          rescheduling
            ? "The previous appointment will be canceled atomically. The request owner must accept this replacement before it is confirmed."
            : "The request owner decides whether to accept the offer."
        }
        className="[font-family:var(--font-echo-sans)] [&_button[aria-label]]:min-h-11 [&_button[aria-label]]:min-w-11"
      >
        {confirmation}
      </EchoDialog>
    </>
  );
}
