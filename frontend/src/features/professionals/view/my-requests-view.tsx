"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Flag, MessageCircle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { ROUTES } from "@/config/routes.config";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { ProfessionalSupportHeader } from "../components/professional-support-header";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import { experienceApi } from "@/services/experience/experience-api";
import type { Phq8Assessment } from "@echo/contracts";
import {
  professionalApi,
  type CaseDetail,
  type CaseEvent,
  type CaseMessage,
  type Organization,
  type SharedRecord,
  type SupportRequest,
} from "@/services/professionals/professional-api";
import { RequestStatus } from "../components/professional-shell";
import { ProfessionalSupportNav } from "../components/professional-support-nav";

const format = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function MyRequestsView() {
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const matchesFilter = (item: SupportRequest) => filter === "all" || (filter === "active" ? ["assigned", "scheduled"].includes(item.status) : item.status === filter);
  useEffect(() => {
    let active = true;
    void Promise.all([professionalApi.ownRequests(), professionalApi.organizations()])
      .then(([own, orgs]) => {
        if (active) {
          setRequests(own.requests);
          setOrganizations(orgs.organizations);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(normalizeError(reason).userMessage);
          setRequests([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <AppShell>
      <ProfessionalSupportNav />
      <ProfessionalSupportHeader
        title="My support requests"
        description="Follow each request and review exactly what you chose to share."
        action={
          <Link href={ROUTES.professionalSupport.newRequest} className="echo-button-primary inline-flex rounded-xl px-5 py-3 text-sm">
            New request
          </Link>
        }
      />
      {requests === null ? (
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Loading support requests</span>
          {[0, 1, 2].map((item) => (
            <EchoSkeleton key={item} variant="rectangular" className="h-28 w-full" />
          ))}
        </div>
      ) : error && requests.length === 0 ? null : requests.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
          No support requests yet. Your private journal remains yours until you choose to share something.
        </div>
      ) : (
        <div className="space-y-3">
          <div role="group" aria-label="Filter support requests" className="flex gap-2 overflow-x-auto pb-1">{[["all", "All"], ["submitted", "Pending"], ["assigned", "Assigned"], ["active", "Active"], ["scheduled", "Scheduled"], ["declined", "Declined"], ["withdrawn", "Withdrawn"], ["closed", "Closed"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-bold transition-colors ${filter === value ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary"}`}>{label}</button>)}</div>
          {requests.filter(matchesFilter).map((item) => (
            <Link
              key={item.id}
              href={ROUTES.professionalSupport.request(item.id)}
              className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-subtle transition-colors hover:border-primary/30"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">
                    {organizations.find((org) => org.id === item.organizationId)?.name ?? "Professional organization"}
                  </strong>
                  <RequestStatus status={item.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Submitted {format(item.createdAt)} · {item.sharingActive ? "Sharing active" : "Sharing stopped"}
                </p>
              </div>
              <ArrowRight size={19} className="text-primary" />
            </Link>
          ))}
          {requests.every((item) => !matchesFilter(item)) ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">No requests with this status.</p> : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}

export function MyRequestDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [records, setRecords] = useState<SharedRecord[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [journalChoices, setJournalChoices] = useState<Array<{ id: string; title: string; createdAt: string }>>([]);
  const [phq8Choices, setPhq8Choices] = useState<Phq8Assessment[]>([]);
  const [shareJournalIds, setShareJournalIds] = useState<string[]>([]);
  const [sharePhq8Ids, setSharePhq8Ids] = useState<string[]>([]);
  const messageDraft = useRef<HTMLTextAreaElement | null>(null);
  const messageClientId = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    setError("");
    try {
      const [caseDetail, messageResult, sharingResult, timelineResult] = await Promise.all([
        professionalApi.ownDetail(id), professionalApi.messages(id), professionalApi.sharing(id), professionalApi.timeline(id),
      ]);
      setDetail(caseDetail);
      setMessages(messageResult.messages);
      setMessageCursor(messageResult.nextCursor);
      setRecords(sharingResult.records);
      setEvents(timelineResult.events);
      void professionalApi.markMessagesRead(id).catch(() => undefined);
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    }
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    let active = true;
    void Promise.all([professionalApi.journalChoices(), experienceApi.getWellnessStatus()]).then(([journals, wellness]) => {
      if (active) { setJournalChoices(journals); setPhq8Choices(wellness.assessment.history); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  async function act(action: "revoke" | "accept" | "decline" | "cancel", appointmentId?: string) {
    setBusy(action);
    setError("");
    try {
      if (action === "revoke") await professionalApi.revoke(id);
      else if (appointmentId && action === "cancel") await professionalApi.cancelAppointment(appointmentId);
      else if (appointmentId) await professionalApi.respondAppointment(appointmentId, action === "accept");
      await refresh();
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setBusy("");
    }
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageDraft.current?.value.trim() ?? "";
    if (!body) return;
    setBusy("message"); setError("");
    try {
      messageClientId.current ??= crypto.randomUUID();
      await professionalApi.sendMessage(id, { clientMessageId: messageClientId.current, body });
      messageClientId.current = null;
      if (messageDraft.current) messageDraft.current.value = "";
      await refresh();
    } catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }
  async function loadOlderMessages() {
    if (!messageCursor) return;
    setBusy("older-messages"); setError("");
    try {
      const result = await professionalApi.messages(id, messageCursor);
      setMessages((current) => [...result.messages, ...current]);
      setMessageCursor(result.nextCursor);
    } catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }
  async function revokeRecord(shareId: string) {
    setBusy(shareId); setError("");
    try { await professionalApi.revokeSharedRecord(id, shareId); await refresh(); }
    catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }
  async function withdraw() {
    if (!window.confirm("Withdraw this support request? Messaging and active appointments will stop.")) return;
    setBusy("withdraw"); setError("");
    try { await professionalApi.withdraw(id); await refresh(); }
    catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }
  async function requestCaseAction(action: "reassignment" | "concern") {
    const confirmed = window.confirm(action === "reassignment"
      ? "Ask the organization to review a different practitioner assignment?"
      : "Report a concern for the organization to review?");
    if (!confirmed) return;
    setBusy(action); setError("");
    try {
      if (action === "reassignment") await professionalApi.requestReassignment(id, "");
      else await professionalApi.reportConcern(id, "other");
      await refresh();
    } catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }
  async function addRecords() {
    if (shareJournalIds.length + sharePhq8Ids.length === 0) return;
    setBusy("add-sharing"); setError("");
    try {
      await professionalApi.addSharing(id, { journalIds: shareJournalIds, phq8Ids: sharePhq8Ids, consent: true });
      setShareJournalIds([]); setSharePhq8Ids([]); await refresh();
    } catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusy(""); }
  }
  return (
    <AppShell>
      <ProfessionalSupportNav />
      <Link
        href={ROUTES.professionalSupport.requests}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft size={16} />
        All requests
      </Link>
      <ProfessionalSupportHeader
        title="Your support request"
        description="Track the response and control future access to the information you shared."
      />
      {!detail && !error ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading request</span>
          <EchoSkeleton variant="rectangular" className="h-52 w-full" />
          <EchoSkeleton variant="rectangular" className="h-40 w-full" />
        </div>
      ) : detail ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl [font-family:var(--font-echo-display)]">What you sent</h2>
                <RequestStatus status={detail.request.status} />
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{detail.request.summary}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                Preferred time: {detail.request.preferredTime || "Not specified"}
              </p>
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 id="case-messages" className="scroll-mt-24 flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]"><MessageCircle size={20} /> Case messages</h2>
              <div aria-live="polite" className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-secondary/30 p-3">
                {messageCursor ? <button type="button" className="mx-auto block text-xs font-bold text-primary underline" disabled={Boolean(busy)} onClick={() => void loadOlderMessages()}>Load older messages</button> : null}
                {messages.length ? messages.map((item) => <div key={item.id} className={`max-w-[85%] rounded-2xl p-3 text-sm leading-6 ${item.sender === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}><p>{item.body}</p><time className={`mt-1 block text-[10px] ${item.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{format(item.createdAt)}</time></div>) : <p className="p-3 text-sm text-muted-foreground">Messages will appear after a practitioner is assigned.</p>}
              </div>
              {["assigned", "scheduled"].includes(detail.request.status) ? <form onSubmit={(event) => void sendMessage(event)} className="mt-3 flex items-end gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Message your practitioner</span><textarea ref={messageDraft} required maxLength={4000} rows={2} className="echo-input resize-none" placeholder="Write a private case message" onChange={() => { messageClientId.current = null; }} /></label><EchoButton type="submit" size="small" isLoading={busy === "message"}>Send</EchoButton></form> : <p className="mt-3 text-xs text-muted-foreground">This case is read-only.</p>}
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="text-2xl [font-family:var(--font-echo-display)]">Journal snapshots selected</h2>
              {detail.sharedJournals.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No journal entries were included.</p>
              ) : (
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
              )}
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]"><Clock3 size={20} /> Case timeline</h2>
              {events.length ? <ol className="mt-4 space-y-3 border-l border-primary/20 pl-5">{events.map((item) => <li key={item.id}><strong className="text-sm">{item.label}</strong><time className="mt-1 block text-xs text-muted-foreground">{format(item.createdAt)}</time></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No case updates yet.</p>}
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                <CalendarDays size={20} />
                Appointments
              </h2>
              {detail.appointments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No appointment has been offered yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.appointments.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-background p-4">
                      <strong className="text-sm">{format(item.startsAt)}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.mode.replace("_", " ")} · {item.locationHint || "Details will be arranged"} ·{" "}
                        {item.status}
                      </p>
                      {item.status === "proposed" ? (
                        <div className="mt-3 flex gap-2">
                          <EchoButton size="small" disabled={Boolean(busy)} onClick={() => void act("accept", item.id)}>
                            Accept
                          </EchoButton>
                          <EchoButton
                            size="small"
                            variant="outline"
                            disabled={Boolean(busy)}
                            onClick={() => void act("decline", item.id)}
                          >
                            Decline
                          </EchoButton>
                        </div>
                      ) : item.status === "confirmed" ? (
                        <EchoButton
                          size="small"
                          variant="outline"
                          className="mt-3"
                          disabled={Boolean(busy)}
                          onClick={() => void act("cancel", item.id)}
                        >
                          Cancel appointment
                        </EchoButton>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
            {detail.referrals.length > 0 ? (
              <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
                <h2 className="text-2xl [font-family:var(--font-echo-display)]">Referrals</h2>
                <ul className="mt-3 space-y-2">
                  {detail.referrals.map((item) => (
                    <li key={item.id} className="text-sm">
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
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <aside className="rounded-3xl border border-primary/20 bg-secondary/60 p-5">
            <ShieldCheck className="mb-3 text-primary" />
            <h2 className="text-xl [font-family:var(--font-echo-display)]">Sharing control</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {detail.request.sharingActive
                ? "Only your assigned professional can open your message and selected journal snapshots. You can stop future access at any time."
                : "Future professional access to your message and selected journal snapshots has stopped. Existing professional records follow the organization's retention policy."}
            </p>
            {detail.request.sharingActive ? (
              <EchoButton
                variant="outline"
                size="small"
                className="mt-4"
                isLoading={busy === "revoke"}
                loadingText="Stopping"
                onClick={() => void act("revoke")}
              >
                Stop sharing
              </EchoButton>
            ) : null}
            <div className="mt-5 space-y-2 border-t border-primary/15 pt-4">
              <h3 className="text-sm font-bold">Shared records</h3>
              {records.length ? records.map((item) => <div key={item.id} className="rounded-xl bg-card p-3"><div className="flex items-start justify-between gap-2"><span><strong className="block text-xs">{item.label}</strong><span className="text-[10px] uppercase text-muted-foreground">{item.resourceType} · {item.revokedAt ? "revoked" : `until ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.expiresAt))}`}</span></span>{!item.revokedAt ? <button type="button" disabled={Boolean(busy)} onClick={() => void revokeRecord(item.id)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" aria-label={`Stop sharing ${item.label}`}><Trash2 size={15} /></button> : null}</div></div>) : <p className="text-xs text-muted-foreground">No record snapshots are shared.</p>}
            </div>
            {detail.request.sharingActive && ["submitted", "assigned", "scheduled"].includes(detail.request.status) ? (
              <details className="mt-4 rounded-xl border border-primary/15 bg-card p-3">
                <summary className="cursor-pointer text-xs font-bold text-primary">Share more records</summary>
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                  {journalChoices.filter((choice) => !records.some((record) => !record.revokedAt && record.sourceRecordId === choice.id)).map((choice) => (
                    <label key={choice.id} className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-primary" checked={shareJournalIds.includes(choice.id)} onChange={() => setShareJournalIds((current) => current.includes(choice.id) ? current.filter((value) => value !== choice.id) : current.length < 3 ? [...current, choice.id] : current)} /> Journal: {choice.title || "Untitled reflection"}</label>
                  ))}
                  {phq8Choices.filter((choice) => !records.some((record) => !record.revokedAt && record.sourceRecordId === choice.id)).map((choice) => (
                    <label key={choice.id} className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-primary" checked={sharePhq8Ids.includes(choice.id)} onChange={() => setSharePhq8Ids((current) => current.includes(choice.id) ? current.filter((value) => value !== choice.id) : current.length < 3 ? [...current, choice.id] : current)} /> PHQ-8: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(choice.completedAt))}</label>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Adding records creates encrypted snapshots under the case&apos;s existing consent expiry.</p>
                <EchoButton size="small" className="mt-3" disabled={shareJournalIds.length + sharePhq8Ids.length === 0} isLoading={busy === "add-sharing"} onClick={() => void addRecords()}>Share selected</EchoButton>
              </details>
            ) : null}
            {["assigned", "scheduled"].includes(detail.request.status) ? (
              <div className="mt-4 grid gap-2 border-t border-primary/15 pt-4">
                <EchoButton variant="ghost" size="small" isLoading={busy === "reassignment"} onClick={() => void requestCaseAction("reassignment")}>
                  <RefreshCw size={15} aria-hidden="true" /> Request reassignment
                </EchoButton>
                <EchoButton variant="ghost" size="small" isLoading={busy === "concern"} onClick={() => void requestCaseAction("concern")}>
                  <Flag size={15} aria-hidden="true" /> Report a concern
                </EchoButton>
              </div>
            ) : null}
            {["submitted", "assigned", "scheduled"].includes(detail.request.status) ? <EchoButton variant="ghost" size="small" className="mt-4 text-danger" isLoading={busy === "withdraw"} onClick={() => void withdraw()}>Withdraw request</EchoButton> : null}
            <Link href="/crisis" className="mt-5 block text-sm font-semibold text-primary underline">
              Need urgent help now?
            </Link>
          </aside>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}
