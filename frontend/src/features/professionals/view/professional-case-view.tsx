"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, CalendarDays, FileText, HeartHandshake, MessageCircle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { normalizeError } from "@/shared/errors/normalize-error";
import { professionalApi, type CaseDetail, type CaseMessage } from "@/services/professionals/professional-api";
import { ProfessionalShell, ProfessionalSkeleton, RequestStatus } from "../components/professional-shell";

const format = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ProfessionalCaseView({ id }: { id: string }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mode, setMode] = useState<"in_person" | "online" | "phone">("in_person");
  const [locationHint, setLocationHint] = useState("");
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const messageClientId = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    setDetail(null);
    try {
      const [caseDetail, caseMessages] = await Promise.all([professionalApi.caseDetail(id), professionalApi.caseMessages(id)]);
      setDetail(caseDetail);
      setMessages(caseMessages.messages);
      setMessageCursor(caseMessages.nextCursor);
      void professionalApi.markCaseMessagesRead(id).catch(() => undefined);
      setError("");
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    }
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(
    kind: "note" | "referral" | "appointment" | "cancel" | "complete" | "close",
    event?: FormEvent<HTMLFormElement>,
    appointmentId?: string,
  ) {
    event?.preventDefault();
    setBusy(kind);
    setError("");
    try {
      if (kind === "note") {
        await professionalApi.addNote(id, note.trim());
        setNote("");
      }
      if (kind === "referral") {
        await professionalApi.addReferral(id, resourceName.trim(), resourceUrl.trim() || null);
        setResourceName("");
        setResourceUrl("");
      }
      if (kind === "appointment") {
        if (!start || !end || new Date(end) <= new Date(start))
          throw new Error("Choose an end time after the start time.");
        await professionalApi.proposeAppointment(id, {
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          mode,
          locationHint: locationHint.trim(),
        });
        setStart("");
        setEnd("");
        setLocationHint("");
      }
      if (kind === "cancel" && appointmentId) await professionalApi.cancelAppointment(appointmentId);
      if (kind === "complete" && appointmentId) await professionalApi.completeAppointment(appointmentId);
      if (kind === "close") await professionalApi.close(id);
      await refresh();
    } catch (reason) {
      const failure = normalizeError(reason);
      if ([401, 403, 404].includes(failure.statusCode ?? 0)) setDetail(null);
      setError(
        reason instanceof Error && reason.message.startsWith("Choose an end")
          ? reason.message
          : failure.userMessage,
      );
    } finally {
      setBusy("");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy("message"); setError("");
    try {
      messageClientId.current ??= crypto.randomUUID();
      await professionalApi.sendCaseMessage(id, { clientMessageId: messageClientId.current, body: message.trim() });
      messageClientId.current = null; setMessage(""); await refresh();
    }
    catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }

  async function loadOlderMessages() {
    if (!messageCursor) return;
    setBusy("older-messages"); setError("");
    try {
      const result = await professionalApi.caseMessages(id, messageCursor);
      setMessages((current) => [...result.messages, ...current]);
      setMessageCursor(result.nextCursor);
    } catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }

  const closed = detail?.request.status === "closed" || detail?.request.status === "declined";
  const activeAppointment = detail?.appointments.some(
    (item) => item.status === "proposed" || item.status === "confirmed",
  );
  return (
    <ProfessionalShell>
      <Link href="/professional" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft size={16} />
        Request queue
      </Link>
      <PageHeader
        title={`Case ${id.slice(0, 8).toUpperCase()}`}
        description="A focused view of the user-submitted request, agreed sharing, appointments, and follow-up."
        action={detail ? <RequestStatus status={detail.request.status} /> : null}
      />
      {!detail && !error ? (
        <ProfessionalSkeleton title="Loading case details" />
      ) : detail ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-subtle sm:p-7">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" aria-hidden="true" />
                <h2 className="text-2xl [font-family:var(--font-echo-display)]">What the user shared</h2>
              </div>
              {detail.request.sharingActive ? (
                <>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{detail.request.summary}</p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Preferred time: {detail.request.preferredTime || "Not specified"}
                  </p>
                </>
              ) : (
                <p className="mt-4 rounded-xl bg-secondary p-4 text-sm">
                  The user stopped sharing or this grant expired. Their message and selected journal snapshots are
                  unavailable.
                </p>
              )}
            </section>
            {detail.request.sharingActive && detail.sharedJournals.length > 0 ? (
              <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
                <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                  <BookOpen size={19} className="text-primary" />
                  Selected journal snapshots
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Copies explicitly selected when this request was submitted.
                </p>
                <div className="mt-4 space-y-3">
                  {detail.sharedJournals.map((item) => (
                    <details key={item.journalId} className="rounded-xl border border-border p-4">
                      <summary className="cursor-pointer font-semibold text-primary">
                        {item.title || "Untitled reflection"}
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}
            {detail.request.sharingActive && detail.sharedPhq8.length > 0 ? (
              <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
                <h2 className="text-2xl [font-family:var(--font-echo-display)]">Selected PHQ-8 results</h2>
                <p className="mt-1 text-xs text-muted-foreground">Minimized, non-diagnostic snapshots. Raw answers are not shared.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">{detail.sharedPhq8.map((item) => <div key={item.id} className="rounded-2xl bg-secondary/45 p-4"><strong className="text-sm">{item.label}</strong><p className="mt-2 text-2xl font-bold text-primary">{item.score}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 24</span></p><p className="mt-1 text-xs capitalize text-muted-foreground">{item.severity.replaceAll("_", " ")} · {item.context}</p></div>)}</div>
              </section>
            ) : null}
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]"><MessageCircle size={19} className="text-primary" /> Case messages</h2>
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-secondary/30 p-3">{messageCursor ? <button type="button" className="mx-auto block text-xs font-bold text-primary underline" disabled={Boolean(busy)} onClick={() => void loadOlderMessages()}>Load older messages</button> : null}{messages.length ? messages.map((item) => <div key={item.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${item.sender === "professional" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}><p>{item.body}</p><time className="mt-1 block text-[10px] opacity-70">{format(item.createdAt)}</time></div>) : <p className="p-3 text-sm text-muted-foreground">No case messages yet.</p>}</div>
              {!closed ? <form className="mt-3 flex items-end gap-2" onSubmit={(event) => void sendMessage(event)}><label className="min-w-0 flex-1"><span className="sr-only">Message the user</span><textarea required maxLength={4000} rows={2} className="echo-input resize-none" value={message} onChange={(event) => { messageClientId.current = null; setMessage(event.target.value); }} placeholder="Write a case-linked message" /></label><EchoButton type="submit" size="small" isLoading={busy === "message"}>Send</EchoButton></form> : <p className="mt-3 text-xs text-muted-foreground">Closed cases are read-only.</p>}
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                <CalendarDays size={19} className="text-primary" />
                Appointments
              </h2>
              <div className="mt-4 space-y-2">
                {detail.appointmentChangeRequests.filter((item) => item.status === "pending").map((item) => (
                  <div key={item.id} className="rounded-xl border border-primary/20 bg-secondary/45 p-4 text-sm">
                    <strong>Change requested</strong>
                    <p className="mt-1 text-xs text-muted-foreground">Preferred time: {item.preferredTime}</p>
                  </div>
                ))}
                {detail.appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointment offered yet.</p>
                ) : (
                  detail.appointments.map((item) => (
                    <div key={item.id} className="rounded-xl bg-secondary/45 p-4 text-sm">
                      <strong>{format(item.startsAt)}</strong>
                      <span className="ml-2 text-xs text-muted-foreground">{item.status}</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.mode.replace("_", " ")} · {item.locationHint || "Details to be arranged"}
                      </p>
                      {!closed && (item.status === "proposed" || item.status === "confirmed") ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.status === "confirmed" ? (
                            <EchoButton
                              size="small"
                              disabled={Boolean(busy)}
                              onClick={() => void act("complete", undefined, item.id)}
                            >
                              Mark complete
                            </EchoButton>
                          ) : null}
                          <EchoButton
                            size="small"
                            variant="outline"
                            disabled={Boolean(busy)}
                            onClick={() => void act("cancel", undefined, item.id)}
                          >
                            Cancel appointment
                          </EchoButton>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              {!closed && !activeAppointment ? (
                <form
                  onSubmit={(event) => void act("appointment", event)}
                  className="mt-5 grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2"
                >
                  <label className="text-xs font-semibold">
                    Starts
                    <input
                      type="datetime-local"
                      required
                      className="echo-input mt-1"
                      value={start}
                      onChange={(event) => setStart(event.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Ends
                    <input
                      type="datetime-local"
                      required
                      className="echo-input mt-1"
                      value={end}
                      onChange={(event) => setEnd(event.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Mode
                    <select
                      className="echo-input mt-1"
                      value={mode}
                      onChange={(event) => setMode(event.target.value as typeof mode)}
                    >
                      <option value="in_person">In person</option>
                      <option value="online">Online</option>
                      <option value="phone">Phone</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    Meeting details
                    <input
                      maxLength={240}
                      className="echo-input mt-1"
                      placeholder="Room or joining instructions"
                      value={locationHint}
                      onChange={(event) => setLocationHint(event.target.value)}
                    />
                  </label>
                  <EchoButton
                    type="submit"
                    isLoading={busy === "appointment"}
                    loadingText="Proposing"
                    className="sm:col-span-2"
                  >
                    Propose appointment
                  </EchoButton>
                </form>
              ) : null}
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                <FileText size={19} className="text-primary" />
                Case notes
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Restricted professional records. These are separate from the user&apos;s private journal.
              </p>
              <div className="mt-4 space-y-2">
                {detail.notes.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-background p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{format(item.createdAt)}</p>
                  </div>
                ))}
                {detail.notes.length === 0 ? <p className="text-sm text-muted-foreground">No case notes yet.</p> : null}
              </div>
              {!closed ? (
                <form onSubmit={(event) => void act("note", event)} className="mt-4">
                  <label htmlFor="case-note" className="sr-only">
                    New case note
                  </label>
                  <textarea
                    id="case-note"
                    required
                    minLength={2}
                    maxLength={4000}
                    rows={4}
                    className="echo-input"
                    placeholder="Document the follow-up needed. Avoid unnecessary personal details."
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <EchoButton
                    type="submit"
                    size="small"
                    className="mt-2"
                    isLoading={busy === "note"}
                    loadingText="Saving"
                  >
                    Save note
                  </EchoButton>
                </form>
              ) : null}
            </section>
          </div>
          <aside className="space-y-5">
            <section className="rounded-3xl border border-border/70 bg-card p-5">
              <h2 className="flex items-center gap-2 text-xl [font-family:var(--font-echo-display)]">
                <HeartHandshake size={18} className="text-primary" />
                Referrals
              </h2>
              <div className="mt-3 space-y-2">
                {detail.referrals.map((item) => (
                  <p key={item.id} className="text-sm">
                    {item.resourceUrl ? (
                      <a
                        href={item.resourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline"
                      >
                        {item.resourceName}
                      </a>
                    ) : (
                      item.resourceName
                    )}
                  </p>
                ))}
                {detail.referrals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No referrals yet.</p>
                ) : null}
              </div>
              {!closed ? (
                <form onSubmit={(event) => void act("referral", event)} className="mt-4 space-y-2">
                  <label className="block text-xs font-semibold">
                    Resource name
                    <input
                      required
                      minLength={2}
                      maxLength={160}
                      className="echo-input mt-1"
                      value={resourceName}
                      onChange={(event) => setResourceName(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold">
                    Secure website, optional
                    <input
                      type="url"
                      pattern="https://.*"
                      className="echo-input mt-1"
                      placeholder="https://"
                      value={resourceUrl}
                      onChange={(event) => setResourceUrl(event.target.value)}
                    />
                  </label>
                  <EchoButton
                    type="submit"
                    size="small"
                    variant="outline"
                    isLoading={busy === "referral"}
                    loadingText="Saving"
                  >
                    Add referral
                  </EchoButton>
                </form>
              ) : null}
            </section>
            <section className="rounded-3xl border border-primary/20 bg-secondary/60 p-5">
              <h2 className="text-xl [font-family:var(--font-echo-display)]">Next action</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                ECHO is not an emergency monitoring service. For immediate danger, direct the user to available
                emergency support.
              </p>
              <Link href="/support/find-help" className="mt-3 block text-sm font-semibold text-primary underline">
                Reviewed support resources
              </Link>
              {!closed ? (
                <EchoButton
                  variant="outline"
                  size="small"
                  className="mt-5"
                  isLoading={busy === "close"}
                  loadingText="Closing"
                  onClick={() => void act("close")}
                >
                  Close case
                </EchoButton>
              ) : null}
            </section>
          </aside>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
          {error}{" "}
          <Link href="/settings/security" className="font-semibold text-primary underline">
            Review account security
          </Link>
        </p>
      ) : null}
    </ProfessionalShell>
  );
}
