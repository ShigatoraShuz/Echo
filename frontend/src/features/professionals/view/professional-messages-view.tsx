"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, MessageCircle, ShieldCheck } from "lucide-react";
import { ROUTES } from "@/config/routes.config";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { ProfessionalSupportHeader } from "../components/professional-support-header";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import {
  professionalApi,
  type CaseMessage,
  type Organization,
  type SharedRecord,
  type SupportRequest,
} from "@/services/professionals/professional-api";
import { ProfessionalSupportNav } from "../components/professional-support-nav";
import { RequestStatus } from "../components/professional-shell";
import { mergeCaseMessages, validateCaseMessages } from "../professional-messaging.model";

const format = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ProfessionalMessagesView() {
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [records, setRecords] = useState<SharedRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadReady, setThreadReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sharingError, setSharingError] = useState("");
  const messageClientId = useRef<string | null>(null);
  const pendingAction = useRef(false);
  const threadGeneration = useRef(0);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    let active = true;
    void professionalApi
      .ownRequests()
      .then((own) => {
        if (!active) return;
        const cases = own.requests;
        setRequests(cases);
        setSelectedId(cases[0]?.id ?? "");
      })
      .catch((reason) => {
        if (active) {
          setError(normalizeError(reason).userMessage);
          setRequests([]);
        }
      });
    void professionalApi
      .organizations()
      .then((result) => {
        if (active) setOrganizations(result.organizations);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    threadGeneration.current += 1;
    setLoadingThread(true);
    setThreadReady(false);
    setError("");
    setMessages([]);
    setRecords([]);
    setSharingError("");
    void professionalApi
      .messages(selectedId)
      .then((thread) => {
        if (!active) return;
        validateCaseMessages(thread.messages, selectedId);
        setMessages(thread.messages);
        setCursor(thread.nextCursor);
        setThreadReady(true);
        void professionalApi.markMessagesRead(selectedId).catch(() => undefined);
      })
      .catch((reason) => {
        if (active) setError(normalizeError(reason).userMessage);
      })
      .finally(() => {
        if (active) setLoadingThread(false);
      });
    void professionalApi
      .sharing(selectedId)
      .then((sharing) => {
        if (active) setRecords(sharing.records);
      })
      .catch((reason) => {
        if (active) setSharingError(normalizeError(reason).userMessage);
      });
    return () => {
      active = false; threadGeneration.current += 1;
    };
  }, [selectedId, retryCount]);

  const selected = requests?.find((item) => item.id === selectedId);
  const organizationName = (id: string) =>
    organizations.find((item) => item.id === id)?.name ?? "Professional organization";
  const canSend =
    threadReady &&
    Boolean(selected?.assignedTo) &&
    selected?.sharingActive &&
    ["assigned", "scheduled"].includes(selected.status);
  const activeRecords = records.filter((item) => !item.revokedAt && new Date(item.expiresAt) > new Date());

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction.current || !selectedId || !draft.trim() || !canSend) return;
    pendingAction.current = true;
    const generation = threadGeneration.current;
    setBusy("send");
    setError("");
    try {
      messageClientId.current ??= crypto.randomUUID();
      const { message } = await professionalApi.sendMessage(selectedId, {
        clientMessageId: messageClientId.current,
        body: draft.trim(),
      });
      if (selectedIdRef.current === selectedId && generation === threadGeneration.current) {
        validateCaseMessages([message], selectedId);
        if (message.sender !== "user" || message.body !== draft.trim()) throw new Error("Message receipt could not be confirmed.");
        messageClientId.current = null;
        setMessages((current) => mergeCaseMessages(current, [message]));
        setDraft("");
      }
    } catch (reason) {
      if (generation === threadGeneration.current) setError(normalizeError(reason).userMessage);
    } finally {
      pendingAction.current = false;
      if (generation === threadGeneration.current) setBusy("");
    }
  }

  async function refreshConversation() {
    if (pendingAction.current || !selectedId) return;
    pendingAction.current = true; setBusy("refresh"); setError("");
    const generation = threadGeneration.current;
    try {
      const own = await professionalApi.ownRequests();
      if (generation !== threadGeneration.current) return;
      setRequests(own.requests);
      if (!own.requests.some(item => item.id === selectedId)) {
        setSelectedId(""); setMessages([]); setRecords([]); setCursor(null); setThreadReady(false); setDraft("");
      } else setRetryCount(value => value + 1);
    } catch (reason) {
      if (generation === threadGeneration.current) { setMessages([]); setRecords([]); setThreadReady(false); setError(normalizeError(reason).userMessage); }
    } finally { pendingAction.current = false; setBusy(""); }
  }

  async function loadOlder() {
    if (pendingAction.current || !cursor || !selectedId) return;
    pendingAction.current = true;
    const generation = threadGeneration.current;
    setBusy("older");
    setError("");
    try {
      const result = await professionalApi.messages(selectedId, cursor);
      if (selectedIdRef.current === selectedId && generation === threadGeneration.current) {
        validateCaseMessages(result.messages, selectedId);
        setMessages((current) => mergeCaseMessages(result.messages, current));
        setCursor(result.nextCursor);
      }
    } catch (reason) {
      if (generation === threadGeneration.current) setError(normalizeError(reason).userMessage);
    } finally {
      pendingAction.current = false;
      if (generation === threadGeneration.current) setBusy("");
    }
  }

  return (
    <AppShell>
      <ProfessionalSupportNav />
      <ProfessionalSupportHeader
        label="Private case conversations"
        title="Messages"
        description="Read and reply to your assigned support team. Messages are asynchronous and are not monitored for emergencies."
      />
      {requests === null ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading conversations</span>
          <EchoSkeleton variant="rectangular" className="h-80" />
        </div>
      ) : error && requests.length === 0 ? null : requests.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-7">
          <MessageCircle className="text-primary" />
          <h2 className="mt-3 text-lg font-semibold">No case conversations yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Messaging becomes available when a practitioner is assigned to your support request.
          </p>
          <Link
            href={ROUTES.professionalSupport.requests}
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary"
          >
            View my requests <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[275px_minmax(0,1fr)_250px]">
          <nav
            aria-label="Your support conversations"
            className="min-w-0 rounded-[1.3rem] border border-border/70 bg-card/95 p-3 shadow-subtle lg:max-h-[70vh] lg:overflow-y-auto"
          >
            <h2 className="px-2 py-2 text-xs font-black uppercase tracking-wider text-primary">Conversations</h2>
            {requests.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (item.id === selectedId || pendingAction.current) return;
                  threadGeneration.current += 1;
                  setMessages([]); setRecords([]); setCursor(null); setThreadReady(false); setLoadingThread(true); setError(""); setSharingError("");
                  setSelectedId(item.id);
                  setDraft("");
                  messageClientId.current = null;
                }}
                aria-current={selectedId === item.id ? "true" : undefined}
                className={`mb-1 w-full rounded-xl p-3 text-left transition-colors ${selectedId === item.id ? "bg-secondary text-primary" : "hover:bg-secondary/60"}`}
              >
                <strong className="block truncate text-sm">
                  {item.assignedProfessional?.displayName ?? organizationName(item.organizationId)}
                </strong>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{organizationName(item.organizationId)}</span>
                  <RequestStatus status={item.status} />
                </span>
              </button>
            ))}
          </nav>
          <section
            aria-label="Selected conversation"
            className="flex min-h-[480px] min-w-0 flex-col rounded-[1.3rem] border border-border/70 bg-card/95 shadow-subtle lg:h-[70vh]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 p-4">
              <div>
                <h2 className="font-semibold">
                  {selected?.assignedProfessional?.displayName ??
                    (selected ? organizationName(selected.organizationId) : "Support conversation")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selected ? organizationName(selected.organizationId) : ""}
                </p>
              </div>
              {selected ? <button type="button" disabled={Boolean(busy) || loadingThread} onClick={() => void refreshConversation()} className="min-h-11 text-xs font-bold text-primary">Refresh conversation</button> : null}
              {selected ? (
                <Link href={ROUTES.professionalSupport.request(selected.id)} className="text-xs font-bold text-primary">
                  Case details <ArrowRight size={13} className="inline" />
                </Link>
              ) : null}
            </div>
            <div aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-secondary/20 p-4">
              {loadingThread ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading messages…
                </p>
              ) : (
                <>
                  {cursor ? (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void loadOlder()}
                      className="mx-auto block text-xs font-bold text-primary underline"
                    >
                      {busy === "older" ? "Loading…" : "Load older messages"}
                    </button>
                  ) : null}
                  {messages.length ? (
                    messages.map((item) => (
                      <div
                        key={item.id}
                        className={`max-w-[88%] rounded-2xl p-3 text-sm leading-6 sm:max-w-[75%] ${item.sender === "user" ? "ml-auto bg-primary text-primary-foreground" : "border border-border/70 bg-card"}`}
                      >
                        <p className="whitespace-pre-wrap break-words">{item.body}</p>
                        <time className="mt-1 block text-[10px] opacity-70">{format(item.createdAt)}</time>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No messages in this case yet.</p>
                  )}
                </>
              )}
            </div>
            {canSend ? (
              <form
                onSubmit={(event) => void send(event)}
                className="flex items-end gap-2 border-t border-border/70 p-3"
              >
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Message your practitioner</span>
                  <textarea
                    className="echo-input resize-none"
                    rows={2}
                    maxLength={4000}
                    required
                    disabled={Boolean(busy)}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      messageClientId.current = null;
                    }}
                    placeholder="Write a private case message"
                  />
                </label>
                <EchoButton type="submit" size="small" disabled={!draft.trim()} isLoading={busy === "send"}>
                  Send
                </EchoButton>
              </form>
            ) : threadReady ? (
              <p className="border-t border-border/70 p-4 text-xs text-muted-foreground">
                This case is read-only. You can still review its history.
              </p>
            ) : error ? (
              <button
                type="button"
                onClick={() => setRetryCount((value) => value + 1)}
                className="border-t border-border/70 p-4 text-left text-xs font-bold text-primary"
              >
                Could not load this conversation. Try again
              </button>
            ) : null}
          </section>
          <aside className="rounded-[1.3rem] border border-border/70 bg-card/95 p-4 shadow-subtle lg:col-span-2 2xl:col-span-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-primary" />
              <h2 className="text-sm font-semibold">Shared references</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Record snapshots are shared only by your explicit case consent. Messages support text; manage journal and
              PHQ-8 access in case details.
            </p>
            <div className="mt-3 space-y-2">
              {sharingError ? (
                <p role="alert" className="text-xs text-danger">
                  Shared records could not be loaded. {sharingError}
                </p>
              ) : activeRecords.length ? (
                activeRecords.map((item) => (
                  <div key={item.id} className="rounded-xl bg-secondary/60 p-3">
                    <strong className="block truncate text-xs">{item.label}</strong>
                    <span className="text-[11px] capitalize text-muted-foreground">{item.resourceType}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No active record snapshots.</p>
              )}
            </div>
            {selected ? (
              <Link
                href={ROUTES.professionalSupport.request(selected.id)}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary"
              >
                Manage sharing <ArrowRight size={13} />
              </Link>
            ) : null}
            <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              Need immediate support?{" "}
              <Link href="/crisis" className="font-bold text-danger underline">
                Open crisis help
              </Link>
              .
            </div>
          </aside>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}
