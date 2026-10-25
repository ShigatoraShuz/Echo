"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, MessageCircle, RefreshCw, Search, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { professionalApi, type QueueRequest } from "@/services/professionals/professional-api";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { professionalCaseHref, scopedRequestMetadata } from "../professional-request.model";
import { reportProfessionalAccessLoss } from "../professional-access-feedback";
import { mergeCaseMessages, messageEligibility, validateCaseMessages, validateSentCaseMessage } from "../professional-messaging.model";
import { ProfessionalMessageFrame, ProfessionalConversationRow, ProfessionalMessageBubble } from "./professional-message-presentation";

type Scope = { organizationId: string; userId: string };
type MessagePage = Awaited<ReturnType<typeof professionalApi.caseMessages>>;
const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export default function ProfessionalMessageDrawer({ organizationId, userId, role, onClose, instant, enteredAt }: Scope & { role: string; onClose: () => void; instant: boolean; enteredAt: number }) {
  const entryDelay = useRef(Math.max(0, performance.now() - enteredAt)).current;
  const clinical = ["counselor", "psychologist", "social_worker"].includes(role);
  const [rows, setRows] = useState<QueueRequest[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");
  const pending = useRef<ReturnType<typeof professionalApi.queue> | null>(null);
  const generation = useRef(0);
  const dialog = useFocusTrap<HTMLElement>(true);
  const load = useCallback(async () => {
    if (!clinical) return;
    const current = ++generation.current;
    setRows(null); setError("");
    try {
      const result = await (pending.current ??= professionalApi.queue(organizationId, { assignedTo: userId, sort: "updated", limit: 100 }).finally(() => { pending.current = null; }));
      if (current !== generation.current) return;
      setRows(scopedRequestMetadata(result.requests, organizationId).filter(row => row.assignedTo === userId));
      setHasMore(result.page?.hasMore ?? result.requests.length >= 100);
    } catch (reason) { if (current === generation.current) { setRows(null); setError(reportProfessionalAccessLoss(reason).message); } }
  }, [clinical, organizationId, userId]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    const workspace = document.querySelector<HTMLElement>(".professional-portal");
    const wasInert = workspace?.inert;
    if (workspace) workspace.inert = true;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button[aria-label='Close messages']")?.focus();
    return () => { document.body.style.overflow = previous; if (workspace) workspace.inert = wasInert ?? false; };
  }, [dialog]);
  const visible = rows?.filter(row => row.id.toLowerCase().includes(search.toLowerCase().trim()) && (filter === "All" || filter === "Active" && ["assigned", "scheduled"].includes(row.status) || filter === "Closed" && row.status === "closed"));
  return <ProfessionalMessageFrame containerRef={dialog} onClose={onClose} instant={instant} entryDelay={entryDelay}>
      {!clinical ? <div className="pro-message-empty"><ShieldCheck size={32} aria-hidden="true" /><h3>Conversations stay with the care team</h3><p>Your administrative role does not provide access to private case messages.</p></div> : selected ? <MessageThread key={selected} caseId={selected} organizationId={organizationId} userId={userId} onBack={() => { setSelected(null); requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>("input")?.focus()); }} onClose={onClose} /> : <>
        <div className="pro-message-tools"><p className="text-sm font-semibold">Your case conversations</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose an assigned case to view its messages.</p><label className="pro-message-search"><Search size={17} aria-hidden="true" /><input aria-label="Search case conversations" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by case ID" type="search" /></label><div className="pro-message-tabs" role="group" aria-label="Conversation status">{["All", "Active", "Closed"].map(tab => <button key={tab} type="button" aria-pressed={filter === tab} className="echo-focus-ring" onClick={() => setFilter(tab)}>{tab}</button>)}</div></div>
        <div className="pro-message-scroll">
          {error ? <div role="alert" className="pro-message-empty"><h3>Conversations couldn’t be loaded</h3><p>{error}</p><button type="button" className="echo-focus-ring pro-text-action" onClick={() => void load()}><RefreshCw size={16} />Retry conversations</button></div> : rows === null ? <div role="status" aria-busy="true" aria-label="Loading case conversations" className="space-y-3 p-5">{[0,1,2].map(value => <div key={value} className="h-24 rounded-2xl bg-secondary/60 motion-safe:animate-pulse" />)}</div> : visible?.length ? <ul className="pro-conversation-list">{visible.map(row => <ProfessionalConversationRow key={row.id} row={row} onSelect={setSelected} />)}</ul> : <div className="pro-message-empty"><MessageCircle size={32} aria-hidden="true" /><h3>{rows.length ? "No matching cases" : "A quieter inbox"}</h3><p>{rows.length ? "Try another case ID or status." : "Conversations for cases assigned to you will be available here."}</p></div>}
        </div><footer className="pro-message-footer"><ShieldCheck size={14} aria-hidden="true" /><p>Only your assigned cases in this organization.{hasMore ? " Showing the latest 100; older cases can be opened from My cases." : ""} Messages load when you select a case.</p></footer>
      </>}
  </ProfessionalMessageFrame>;
}

function MessageThread({ caseId, organizationId, userId, onBack, onClose }: Scope & { caseId: string; onBack: () => void; onClose: () => void }) {
  const [page, setPage] = useState<MessagePage | null>(null);
  const [writable, setWritable] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{ clientMessageId: string; body: string } | null>(null);
  const mutation = useRef(false);
  const olderPending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const pending = useRef<Promise<{ eligibility: ReturnType<typeof messageEligibility>; messages: MessagePage | null }> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setPage(null); setWritable(false); setError(""); setAvailable(true);
    try {
      const result = await (pending.current ??= (async () => {
        const eligibility = messageEligibility(await professionalApi.caseDetail(caseId), caseId, organizationId, userId);
        if (!mounted.current) return { eligibility, messages: null };
        const messages = eligibility.available ? await professionalApi.caseMessages(caseId) : null;
        if (messages) validateCaseMessages(messages.messages, caseId);
        return { eligibility, messages };
      })().finally(() => { pending.current = null; }));
      if (current !== generation.current) return;
      setAvailable(result.eligibility.available);
      if (!result.messages) return;
      // Acknowledgement is only made for the currently selected, visible thread.
      const acknowledgement = await professionalApi.markCaseMessagesRead(caseId);
      if (current !== generation.current) return;
      if (!acknowledgement.read) throw new Error("Read acknowledgement unavailable");
      setPage(result.messages); setWritable(result.eligibility.writable);
    } catch (reason) { if (current === generation.current) { setPage(null); setWritable(false); setError(reportProfessionalAccessLoss(reason).message); } }
  }, [caseId, organizationId, userId]);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; generation.current += 1; attempt.current = null; }; }, [load]);
  useEffect(() => { if (page && !olderPending.current) bottom.current?.scrollIntoView({ block: "end" }); }, [page]);
  async function older() {
    if (olderPending.current || !page?.nextCursor) return;
    olderPending.current = true; setOlderBusy(true); setError("");
    const current = generation.current;
    try {
      const result = await professionalApi.caseMessages(caseId, page.nextCursor);
      if (current !== generation.current) return;
      validateCaseMessages(result.messages, caseId);
      setPage(value => value ? { messages: mergeCaseMessages(result.messages, value.messages), nextCursor: result.nextCursor } : null);
    } catch (reason) { if (current === generation.current) { setPage(null); setWritable(false); setError(reportProfessionalAccessLoss(reason).message); } }
    finally { if (current === generation.current) { olderPending.current = false; setOlderBusy(false); } }
  }
  async function send() {
    if (mutation.current || !writable || !page || (!attempt.current && !draft.trim())) return;
    mutation.current = true; setSending(true); setError("");
    const current = generation.current;
    const input = attempt.current ??= { clientMessageId: crypto.randomUUID(), body: draft.trim() };
    try {
      const result = await professionalApi.sendCaseMessage(caseId, input);
      if (current !== generation.current) return;
      validateSentCaseMessage(result.message, caseId, input.body);
      setPage(value => value ? { ...value, messages: mergeCaseMessages(value.messages, [result.message]) } : null);
      attempt.current = null; setUncertain(false); setDraft("");
      requestAnimationFrame(() => composer.current?.focus());
    } catch (reason) {
      if (current !== generation.current) return;
      const failure = reportProfessionalAccessLoss(reason);
      if (failure.conceal || failure.kind === "validation") { setPage(null); setWritable(false); attempt.current = null; setDraft(""); setUncertain(false); setError(failure.message); }
      else { setUncertain(true); setError("Delivery could not be confirmed. Retry the same message to check or complete this send."); }
    } finally { if (current === generation.current) { mutation.current = false; setSending(false); } }
  }
  return <>
    <div className="pro-thread-heading"><button type="button" aria-label="Back to conversations" onClick={onBack} className="echo-focus-ring pro-command-icon"><ArrowLeft size={19} aria-hidden="true" /></button><div className="min-w-0 flex-1"><h3>Case {shortId(caseId)}</h3><p>{page ? writable ? "Private case conversation" : "Read-only conversation" : "Checking conversation access"}</p></div><Link prefetch={false} href={professionalCaseHref(caseId, organizationId)} onNavigate={onClose} aria-label="Open this case" className="echo-focus-ring pro-command-icon"><ArrowUpRight size={19} aria-hidden="true" /></Link></div>
    <div className="pro-message-scroll pro-thread-scroll" aria-label="Case messages">
      {!page ? error ? <div role="alert" className="pro-message-empty"><ShieldCheck size={30} aria-hidden="true" /><h3>Conversation unavailable</h3><p>{error}</p><button type="button" onClick={() => void load()} className="echo-focus-ring pro-text-action"><RefreshCw size={16} />Recheck conversation</button></div> : !available ? <div className="pro-message-empty"><MessageCircle size={30} /><h3>Messaging isn’t available for this case</h3><p>Open the case to review supported actions.</p></div> : <div role="status" aria-busy="true" className="space-y-4 p-5"><span className="sr-only">Loading conversation</span><div className="h-20 w-4/5 rounded-2xl bg-secondary/60" /><div className="ml-auto h-16 w-3/4 rounded-2xl bg-secondary/40" /></div> : <>
        {page.nextCursor ? <button type="button" disabled={olderBusy} onClick={() => void older()} className="echo-focus-ring pro-text-action mx-auto">{olderBusy ? "Loading older messages…" : "Load older messages"}</button> : null}
        <p className="pro-thread-privacy"><ShieldCheck size={13} aria-hidden="true" />Visible to you and this case’s ECHO user.</p>
        {page.messages.length ? <ol className="pro-message-bubbles">{page.messages.map(message => <ProfessionalMessageBubble key={message.id} message={message} />)}</ol> : <div className="pro-message-empty"><MessageCircle size={32} /><h3>Start a thoughtful conversation</h3><p>{writable ? "Send a message about this case when you’re ready." : "There are no messages in this case."}</p></div>}
        <div ref={bottom} />
      </>}
    </div>
    {page ? <div className="pro-message-composer">
      {error ? <p role="alert" className="mb-3 text-xs leading-5 text-danger">{error}</p> : null}
      {writable ? <form onSubmit={event => { event.preventDefault(); void send(); }}><label htmlFor={"message-" + caseId} className="sr-only">Message this case</label><textarea ref={composer} id={"message-" + caseId} rows={2} maxLength={4000} placeholder="Write with care…" value={draft} disabled={sending || uncertain} onChange={event => setDraft(event.target.value)} /><div className="pro-composer-actions"><span>{uncertain ? "Same message · safe retry" : "Text messages · " + draft.length + "/4000"}</span><button type="submit" disabled={sending || !draft.trim()} className="echo-focus-ring pro-message-send"><Send size={16} aria-hidden="true" />{sending ? "Sending…" : uncertain ? "Retry same message" : "Send"}</button></div></form> : <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck size={16} className="shrink-0" aria-hidden="true" />Sending is unavailable when a case is closed or consent is inactive. Existing messages remain read-only.</p>}
      {!uncertain ? <button type="button" disabled={sending || olderBusy} className="echo-focus-ring pro-thread-refresh" onClick={() => void load()}><RefreshCw size={12} aria-hidden="true" />Refresh conversation</button> : null}
    </div> : null}
  </>;
}