"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { EchoEmptyState } from "@/shared/components/feedback/echo-empty-state";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { professionalApi, type CaseDetail } from "@/services/professionals/professional-api";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalNotice, ProfessionalPanel, ProfessionalRequestStatus as RequestStatus } from "../components/professional-ui";
import { professionalAccessDestination, professionalAccessFailure, professionalLoginDestination, type ProfessionalAccessFailure } from "../professional-access-feedback";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { professionalOrganizationDestination } from "../professional-return-path";
import { ProfessionalCaseOverview } from "../components/professional-case-overview";
import { requestDate } from "../professional-request.model";
import { ProfessionalCaseSharing } from "../components/professional-case-sharing";
import { consentLimitedCase, noteValidation } from "../professional-case.model";
import { ProfessionalCaseNoteEditor } from "../components/professional-case-note-editor";
import { ProfessionalCaseCloseDialog } from "../components/professional-case-close-dialog";
import { normalizeError } from "@/shared/errors/normalize-error";
import { ProfessionalAppointmentAgenda } from "../components/professional-appointment-agenda";
import { ProfessionalAppointmentCancelDialog } from "../components/professional-appointment-cancel-dialog";
import { ProfessionalAppointmentForm } from "../components/professional-appointment-form";
import type { AgendaPeriod, AppointmentProposal } from "../professional-appointments.model";
import { ProfessionalCaseTimeline } from "../components/professional-case-timeline";
import { ProfessionalCaseReferrals } from "../components/professional-case-referrals";
import type { ReferralInput } from "../professional-referrals.model";
import { ProfessionalFollowUps } from "../components/professional-follow-ups";
import { ProfessionalCrisisSupport } from "../components/professional-crisis-support";

const format = requestDate;

export function ProfessionalCaseView({ id }: { id: string }) {
  const params = useSearchParams();
  return <CaseWorkspace key={`${id}:${params.toString()}`} id={id} />;
}

function CaseWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useRef(false);
  const request = useRef(0);
  const mutation = useRef("");
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [detailRevision, setDetailRevision] = useState(0);
  // Keep only this non-sensitive preference across refreshes. The workspace key
  // resets it for a different case/organization; case records and drafts still clear.
  const [agendaPeriod, setAgendaPeriod] = useState<AgendaPeriod>("upcoming");
  const [error, setError] = useState<ProfessionalAccessFailure | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [success, setSuccess] = useState("");
  const [uncertainNote, setUncertainNote] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [cancelId, setCancelId] = useState("");
  const [referralError, setReferralError] = useState("");
  const [coordinationError, setCoordinationError] = useState("");
  const [uncertainCoordination, setUncertainCoordination] = useState({ appointment: false, referral: false });
  const clearDrafts = useCallback(() => {
    setNote(""); setNoteError(""); setReferralError(""); setCoordinationError("");
  }, []);
  const destination = `/professional/cases/${id}`;
  const reportFailure = useCallback((reason: unknown) => {
    const failure = professionalAccessFailure(reason);
    setError(failure);
    if (failure.kind === "session" || failure.kind === "reauth") router.replace(professionalLoginDestination(destination));
    else if (failure.kind === "mfa") router.replace(professionalAccessDestination(destination));
  }, [destination, router]);
  const refresh = useCallback(async (acknowledgment = "") => {
    const current = ++request.current;
    setDetail(null);
    setConfirmClose(false);
    setCancelId("");
    clearDrafts();
    setError(null);
    setSuccess(acknowledgment);
    try {
      const result = await professionalApi.caseDetail(id);
      if (mounted.current && current === request.current) {
        if (result.viewer !== "professional" || result.request.id !== id) {
          setError({ kind: "denied", title: "Access is not available", message: "Professional case access could not be confirmed.", retry: false, conceal: true });
          return;
        }
        setDetail(consentLimitedCase(result));
        setDetailRevision(current);
      }
    } catch (reason) {
      if (mounted.current && current === request.current) reportFailure(reason);
    }
  }, [id, reportFailure, clearDrafts]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; request.current += 1; };
  }, [refresh]);
  useEffect(() => {
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        request.current += 1;
        if (mutation.current === "note") setUncertainNote(true);
        const pendingCoordination = mutation.current;
        if (pendingCoordination === "appointment" || pendingCoordination === "referral") setUncertainCoordination((current) => ({ ...current, [pendingCoordination]: true }));
        setSuccess("");
        setConfirmClose(false);
        setCancelId("");
        setDetail(null); setError(null); clearDrafts();
      } else void refresh();
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => document.removeEventListener("visibilitychange", visibilityChanged);
  }, [clearDrafts, refresh]);
  useEffect(() => {
    if (!note.trim()) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Leave this case and discard the unsaved note?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeLink, true); };
  }, [note]);

  async function act(
    kind: "note" | "referral" | "appointment" | "cancel" | "close",
    event?: FormEvent<HTMLFormElement>,
    appointmentId?: string,
    input?: AppointmentProposal | ReferralInput,
    closureReason?: string,
  ) {
    event?.preventDefault();
    const proposal = input && "startsAt" in input ? input : undefined;
    const referral = input && "resourceName" in input ? input : undefined;
    if (mutation.current || busy || !detail || error?.conceal) return;
    if (kind === "close" && (!confirmClose || detail.appointments.some((item) => ["proposed", "confirmed"].includes(item.status)))) return;
    if (kind === "cancel" && (!cancelId || appointmentId !== cancelId || !["assigned", "scheduled"].includes(detail.request.status) || !detail.appointments.some((item) => item.id === appointmentId && ["proposed", "confirmed"].includes(item.status)))) return;
    if (kind !== "cancel" && !["assigned", "scheduled"].includes(detail.request.status)) return;
    if (kind === "appointment" && (!proposal || uncertainCoordination.appointment || detail.request.status !== "assigned" || detail.appointments.some((item) => ["proposed", "confirmed"].includes(item.status)))) return;
    if (kind === "referral" && (!referral || uncertainCoordination.referral)) return;
    if (kind !== "note" && note.trim()) {
      if (!window.confirm("Continue this action and discard the unsaved note?")) return;
      setNote(""); setNoteError("");
    }
    if (kind === "note") {
      if (uncertainNote) return;
      const validation = noteValidation(note);
      setNoteError(validation);
      if (validation) return;
    }
    const current = request.current;
    const isCurrent = () => mounted.current && current === request.current;
    setBusy(kind);
    mutation.current = kind;
    setError(null);
    setSuccess("");
    try {
      if (kind === "note") {
        if (detail.notesLifecycleAvailable) await professionalApi.addNote(id, note.trim(), { submissionId: crypto.randomUUID() });
        else await professionalApi.addNote(id, note.trim());
        if (!isCurrent()) return;
        setNote("");
      }
      if (kind === "referral" && referral) await professionalApi.addReferral(id, referral.resourceName, referral.resourceUrl);
      if (kind === "appointment" && proposal) await professionalApi.proposeAppointment(id, proposal);
      if (kind === "cancel" && appointmentId) await professionalApi.cancelAppointment(appointmentId);
      if (kind === "close") {
        if (detail.closureReasonAvailable && closureReason) await professionalApi.close(id, closureReason);
        else await professionalApi.close(id);
      }
      if (!isCurrent()) return;
      await refresh(kind === "note" ? "Note saved. The server confirmed receipt." : kind === "close" ? "Closure confirmed by the server. Checking the latest case status." : kind === "appointment" ? "Appointment proposal recorded. Waiting for the request owner to respond." : kind === "cancel" ? "Appointment cancellation confirmed. Reloading current case status." : "Referral recorded. No external service was contacted.");
    } catch (reason) {
      if (!isCurrent()) return;
      const failure = professionalAccessFailure(reason);
      if (kind === "cancel") {
        setCancelId("");
        if (failure.kind === "validation" || ["network", "server", "unknown"].includes(failure.kind)) {
          setDetail(null); clearDrafts(); request.current += 1;
          setError({ ...failure, retry: true, title: failure.kind === "validation" ? "Appointment has changed" : failure.title,
            message: failure.kind === "validation" ? "This appointment cannot be canceled in its current state. Reload the agenda before taking another action." : "Cancellation could not be confirmed. Reload the agenda to check its status. Cancellation will not be automatically repeated." });
          return;
        }
      }
      if (kind === "referral") {
        const status = normalizeError(reason).statusCode;
        if (status === 400) { setReferralError("The referral was not accepted. Check the resource name and HTTPS website."); return; }
        if (status === 409 || ["network", "server", "unknown"].includes(failure.kind)) {
          if (status !== 409) setUncertainCoordination((current) => ({ ...current, referral: true }));
          setDetail(null); clearDrafts(); request.current += 1;
          setError({ ...failure, retry: true, title: status === 409 ? "Referral needs review" : failure.title,
            message: status === 409 ? "The case state has changed. Reload its referrals before trying again." : "Referral receipt could not be confirmed. Reload and review the recorded referrals before trying again. Nothing will be automatically resent." });
          return;
        }
      }
      if (kind === "appointment") {
        const status = normalizeError(reason).statusCode;
        if (status === 400) { setCoordinationError("The proposal was not accepted. Check the times, session type and meeting details."); return; }
        if (status === 409 || ["network", "server", "unknown"].includes(failure.kind)) {
          if (status !== 409) setUncertainCoordination((current) => ({ ...current, appointment: true }));
          setDetail(null); clearDrafts(); request.current += 1;
          setError({ ...failure, retry: true, title: status === 409 ? "Appointment needs review" : failure.title,
            message: status === 409 ? "The time is booked, an offer is pending, or the case has changed. Reload its appointments before trying again." : "Proposal receipt could not be confirmed. Reload and review appointments before proposing again. Nothing will be automatically resent." });
          return;
        }
      }
      if (kind === "close") {
        setConfirmClose(false);
        if (failure.kind === "validation" || ["network", "server", "unknown"].includes(failure.kind)) {
          const code = String(normalizeError(reason).code);
          setDetail(null); clearDrafts(); request.current += 1;
          setError({ ...failure, retry: true, title: failure.kind === "validation" ? "Case closure needs review" : failure.title,
            message: code === "APPOINTMENT_ACTIVE" ? "Cancel proposed or confirmed appointments before closing. Reload the case to see its current appointments." : failure.kind === "validation" ? "The case could not be closed in its current state. Reload its status and appointments before trying again." : "Closure could not be confirmed. Reload the case to check its status before trying again. This action will not be automatically repeated." });
          return;
        }
      }
      if (kind === "note" && failure.kind === "validation") {
        setNoteError("The note was not accepted. Check its length and current case status before trying again.");
        return;
      }
      if (kind === "note" && ["network", "server", "unknown"].includes(failure.kind)) {
        setUncertainNote(true);
        setDetail(null); clearDrafts(); request.current += 1;
        setError({ ...failure, retry: true, message: "Note receipt could not be confirmed. Reload the case and review its notes before writing again. No note will be automatically resent." });
        return;
      }
      if (professionalAccessFailure(reason).kind !== "validation") {
        setDetail(null);
        clearDrafts();
        request.current += 1;
      }
      reportFailure(reason);
    } finally {
      mutation.current = "";
      if (mounted.current) setBusy("");
    }
  }

  const closed = !detail || !["assigned", "scheduled"].includes(detail.request.status);
  const activeAppointment = detail?.appointments.some(
    (item) => item.status === "proposed" || item.status === "confirmed",
  );
  const organizationId = detail?.request.organizationId ?? searchParams.get("organization") ?? "";
  return (
    <ProfessionalShell organizationId={organizationId}>
      <Link href={organizationId ? professionalOrganizationDestination("/professional/requests", organizationId) : "/professional/requests"} className="echo-focus-ring mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-semibold text-primary">
        <ArrowLeft size={15} aria-hidden="true" />
        Request queue
      </Link>
      <Link href={organizationId ? professionalOrganizationDestination("/professional/my-cases", organizationId) : "/professional/my-cases"} className="echo-focus-ring mb-4 ml-5 inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary">My Cases</Link>
      <div className="mb-5"><EchoButton variant="outline" size="small" disabled={Boolean(busy) || (!detail && !error)} onClick={() => { if (!note.trim() || window.confirm("Refresh and discard the unsaved note?")) void refresh(); }}>Refresh case</EchoButton></div>
      <ProfessionalHeading
        label="Case workspace"
        title={`Case ${id.slice(0, 8).toUpperCase()}`}
        description="A focused view of the user-submitted request, agreed sharing, appointments, and follow-up."
        action={detail ? <RequestStatus status={detail.request.status} /> : null}
      />
      {success ? <p role="status" className="mb-5 rounded-xl border border-primary/20 bg-secondary/60 p-4 text-sm text-primary">{success}</p> : null}
      {!detail && !error ? (
        <ProfessionalSkeleton title="Loading case details" variant="content" />
      ) : detail ? (
        <div key={detailRevision} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-6">
            <ProfessionalCaseOverview detail={detail} />
            <ProfessionalCaseSharing detail={detail} />
            <ProfessionalAppointmentAgenda appointments={detail.appointments} caseId={id} organizationId={organizationId} viewer={detail.viewer} canCancel={!closed} onCancel={(item) => setCancelId(item.id)} busy={Boolean(busy)} period={agendaPeriod} onPeriodChange={setAgendaPeriod}>
              {uncertainCoordination.appointment ? <ProfessionalNotice title="Review appointments before proposing again">
                A previous proposal has an uncertain outcome. Check the refreshed agenda before creating another offer.
                <EchoButton variant="outline" className="mt-3" disabled={Boolean(busy)} onClick={() => setUncertainCoordination((current) => ({ ...current, appointment: false }))}>I reviewed the agenda; enable a new proposal</EchoButton>
              </ProfessionalNotice> : null}
              {detail.request.status === "assigned" && !activeAppointment ? <ProfessionalAppointmentForm appointments={detail.appointments} onPropose={(input) => act("appointment", undefined, undefined, input)} busy={busy === "appointment"} disabled={Boolean(busy && busy !== "appointment") || uncertainCoordination.appointment} error={coordinationError} /> : null}
            </ProfessionalAppointmentAgenda>
            <ProfessionalPanel title="Case notes" icon={FileText} description="Restricted professional records, separate from the user's private journal.">
              <div className="space-y-3">
                {detail.notes.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-background p-4">
                    {item.state === "draft" ? <p className="mb-2 text-xs font-semibold text-primary">Draft · not finalized</p> : null}
                    <p className="break-words whitespace-pre-wrap text-sm leading-7">{item.body}</p>
                    <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">{format(item.createdAt)}</p>
                  </div>
                ))}
                {detail.notes.length === 0 ? <EchoEmptyState icon={<FileText size={22} />} title="No case notes yet." className="py-6" /> : null}
              </div>
              {uncertainNote ? <ProfessionalNotice title="Review notes before writing again">
                A previous save has an uncertain outcome. Check the refreshed notes to avoid recording it twice.
                <EchoButton type="button" variant="outline" size="small" className="mt-3 min-h-11" disabled={Boolean(busy)} onClick={() => setUncertainNote(false)}>I reviewed the notes; enable a new note</EchoButton>
              </ProfessionalNotice> : null}
              {!closed ? <ProfessionalCaseNoteEditor value={note} onChange={(value) => { setNote(value); setNoteError(""); }} onSubmit={(event) => void act("note", event)} error={noteError} busy={busy === "note"} disabled={Boolean(busy && busy !== "note") || uncertainNote} /> : <p className="mt-4 text-xs text-muted-foreground">This case is read-only. New notes cannot be added.</p>}
            </ProfessionalPanel>
          </div>
          <aside className="min-w-0 space-y-6 xl:sticky xl:top-28">
            <ProfessionalCaseTimeline detail={detail} />
            <ProfessionalFollowUps />
            <ProfessionalCrisisSupport />
            <ProfessionalCaseReferrals referrals={detail.referrals} readOnly={closed} onCreate={(input) => act("referral", undefined, undefined, input)} busy={busy === "referral"} disabled={Boolean(busy && busy !== "referral") || uncertainCoordination.referral} error={referralError}>
              {uncertainCoordination.referral ? <ProfessionalNotice title="Review referrals before recording again">
                A previous referral has an uncertain outcome. Check the refreshed records to avoid a duplicate.
                <EchoButton variant="outline" className="mt-3" disabled={Boolean(busy)} onClick={() => setUncertainCoordination((current) => ({ ...current, referral: false }))}>I reviewed the referrals; enable a new record</EchoButton>
              </ProfessionalNotice> : null}
            </ProfessionalCaseReferrals>
            <section className="rounded-3xl border border-primary/20 bg-secondary/60 p-5">
              <h2 className="text-xl [font-family:var(--font-echo-display)]">Next action</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                ECHO is not an emergency monitoring service. For immediate danger, direct the user to available
                emergency support.
              </p>
              <Link href="/support/find-help" className="echo-focus-ring mt-3 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline">
                Reviewed support resources
              </Link>
              {!closed ? (
                <div className="mt-5 space-y-2">
                  {activeAppointment ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Cancel the active appointment before closing this case.
                    </p>
                  ) : null}
                  <EchoButton
                    variant="outline"
                    size="small"
                    className="mt-1 min-h-11 w-full"
                    isLoading={busy === "close"}
                    loadingText="Closing"
                    disabled={Boolean(busy) || Boolean(activeAppointment)}
                    onClick={() => { if (!note.trim() || window.confirm("Discard the unsaved note and review case closure?")) { setNote(""); setConfirmClose(true); } }}
                  >
                    Close case
                  </EchoButton>
                </div>
              ) : null}
              <div className="mt-5 border-t border-border/70 pt-4">
                <EchoButton type="button" variant="outline" size="small" className="min-h-11 w-full" disabled aria-describedby="case-transfer-help">Transfer case unavailable</EchoButton>
                <p id="case-transfer-help" className="mt-2 text-xs leading-6 text-muted-foreground">Case transfer requires a supported authorization and transfer service. No transfer is performed here.</p>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      <ProfessionalCaseCloseDialog key={String(confirmClose)} open={confirmClose && !!detail} onClose={() => setConfirmClose(false)} onConfirm={(reason) => void act("close", undefined, undefined, undefined, reason)} reasonSupported={detail?.closureReasonAvailable} busy={busy === "close"} blocked={!!activeAppointment || closed} />
      <ProfessionalAppointmentCancelDialog appointment={detail?.appointments.find((item) => item.id === cancelId) ?? null} onClose={() => setCancelId("")} onConfirm={() => void act("cancel", undefined, cancelId)} busy={busy === "cancel"} />
      {error ? (
        <div className="mt-6"><ProfessionalAccessError failure={error} destination={destination} onRetry={() => void refresh()} /></div>
      ) : null}
    </ProfessionalShell>
  );
}
