"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, MessageCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { EchoSheet } from "@/shared/components/ui/echo-sheet";
import { normalizeError } from "@/shared/errors/normalize-error";
import { mergeCaseMessages, validateCaseMessages } from "@/features/professionals/professional-messaging.model";
import { professionalApi, type CaseMessage, type SupportRequest } from "@/services/professionals/professional-api";

type Thread = { messages: CaseMessage[]; nextCursor: string | null };

function displayName(request: SupportRequest) {
  return request.assignedProfessional?.displayName ?? `Case ${request.id.slice(0, 8).toUpperCase()}`;
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function UserMessageDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const listEpoch = useRef(0);
  const threadEpoch = useRef(0);
  const sendPending = useRef<number | null>(null);
  const clientMessageId = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const listContainer = useRef<HTMLDivElement>(null);
  const selected = requests?.find((request) => request.id === selectedId);
  const canSend = Boolean(
    thread && selected?.assignedTo && selected.sharingActive && ["assigned", "scheduled"].includes(selected.status),
  );
  const lastMessageId = thread?.messages.at(-1)?.id;

  const loadRequests = useCallback(async () => {
    const current = ++listEpoch.current;
    setLoading(true);
    setError("");
    try {
      const { requests: own } = await professionalApi.ownRequests();
      if (current === listEpoch.current) setRequests(own);
    } catch (reason) {
      if (current === listEpoch.current) setError(normalizeError(reason).userMessage);
    } finally {
      if (current === listEpoch.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      listEpoch.current += 1;
      threadEpoch.current += 1;
      setRequests(null);
      setSelectedId("");
      setThread(null);
      setDraft("");
      setBusy("");
      setError("");
      clientMessageId.current = null;
      sendPending.current = null;
      return;
    }
    void loadRequests();
    return () => {
      listEpoch.current += 1;
    };
  }, [open, loadRequests]);

  useEffect(() => {
    const current = ++threadEpoch.current;
    if (!open || !selectedId) return;
    setThread(null);
    setError("");
    void professionalApi
      .messages(selectedId)
      .then((page) => {
        if (current !== threadEpoch.current) return;
        validateCaseMessages(page.messages, selectedId);
        setThread(page);
        void professionalApi.markMessagesRead(selectedId).catch(() => undefined);
      })
      .catch((reason) => {
        if (current === threadEpoch.current) setError(normalizeError(reason).userMessage);
      });
    return () => {
      threadEpoch.current += 1;
    };
  }, [open, selectedId]);

  useEffect(() => {
    if (lastMessageId) bottom.current?.scrollIntoView?.({ block: "end" });
  }, [lastMessageId, selectedId]);

  function selectRequest(id: string) {
    if (!requests?.some((request) => request.id === id)) return;
    threadEpoch.current += 1;
    setBusy("");
    sendPending.current = null;
    setSelectedId(id);
    setDraft("");
    clientMessageId.current = null;
    requestAnimationFrame(() => backButton.current?.focus());
  }

  function backToConversations() {
    const previousId = selectedId;
    threadEpoch.current += 1;
    sendPending.current = null;
    setBusy("");
    setSelectedId("");
    setThread(null);
    setError("");
    setDraft("");
    clientMessageId.current = null;
    requestAnimationFrame(() => {
      const rows = listContainer.current?.querySelectorAll<HTMLButtonElement>("button[data-request-id]");
      Array.from(rows ?? [])
        .find((row) => row.dataset.requestId === previousId)
        ?.focus();
    });
  }

  async function refresh() {
    if (busy || !selectedId) return;
    const current = ++threadEpoch.current;
    setBusy("refresh");
    setError("");
    setThread(null);
    try {
      const { requests: own } = await professionalApi.ownRequests();
      if (current !== threadEpoch.current) return;
      setRequests(own);
      if (!own.some((request) => request.id === selectedId)) {
        setSelectedId("");
        setDraft("");
        return;
      }
      const page = await professionalApi.messages(selectedId);
      if (current !== threadEpoch.current) return;
      validateCaseMessages(page.messages, selectedId);
      setThread(page);
      void professionalApi.markMessagesRead(selectedId).catch(() => undefined);
    } catch (reason) {
      if (current === threadEpoch.current) setError(normalizeError(reason).userMessage);
    } finally {
      if (current === threadEpoch.current) setBusy("");
    }
  }

  async function loadOlder() {
    if (busy || !selectedId || !thread?.nextCursor) return;
    const current = threadEpoch.current;
    setBusy("older");
    setError("");
    try {
      const page = await professionalApi.messages(selectedId, thread.nextCursor);
      if (current !== threadEpoch.current) return;
      validateCaseMessages(page.messages, selectedId);
      setThread((previous) =>
        previous
          ? { messages: mergeCaseMessages(page.messages, previous.messages), nextCursor: page.nextCursor }
          : null,
      );
    } catch (reason) {
      if (current === threadEpoch.current) setError(normalizeError(reason).userMessage);
    } finally {
      if (current === threadEpoch.current) setBusy("");
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (sendPending.current !== null || busy || !canSend || !body) return;
    const current = threadEpoch.current;
    sendPending.current = current;
    setBusy("send");
    setError("");
    clientMessageId.current ??= crypto.randomUUID();
    try {
      const { message } = await professionalApi.sendMessage(selectedId, {
        clientMessageId: clientMessageId.current,
        body,
      });
      if (current !== threadEpoch.current) return;
      validateCaseMessages([message], selectedId);
      if (message.sender !== "user" || message.body !== body)
        throw new Error("Message receipt could not be confirmed.");
      setThread((previous) =>
        previous ? { ...previous, messages: mergeCaseMessages(previous.messages, [message]) } : null,
      );
      setDraft("");
      clientMessageId.current = null;
    } catch (reason) {
      if (current === threadEpoch.current) setError(normalizeError(reason).userMessage);
    } finally {
      if (sendPending.current === current) sendPending.current = null;
      if (current === threadEpoch.current) setBusy("");
    }
  }

  return (
    <EchoSheet
      open={open}
      onClose={onClose}
      title="Messages"
      description="Private conversations with your support team"
      className="max-w-[440px]"
      contentClassName="flex min-h-0 flex-col !overflow-hidden !p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col [font-family:var(--font-echo-sans)]">
        {selected ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-secondary/30 px-4 py-3">
              <button
                ref={backButton}
                type="button"
                onClick={backToConversations}
                aria-label="Back to conversations"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                <ArrowLeft size={19} aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">{displayName(selected)}</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.status === "closed" ? "Past support request" : "Professional support"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={Boolean(busy)}
                aria-label="Refresh conversation"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 disabled:opacity-50"
              >
                <RefreshCw size={17} aria-hidden="true" />
              </button>
            </div>
            <div
              key={selectedId}
              className="echo-message-view-enter echo-panel-scroll min-h-0 flex-1 overflow-y-auto bg-secondary/20 px-4 py-4"
              aria-label="Case messages"
              aria-live="polite"
            >
              {thread?.nextCursor && (
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  disabled={Boolean(busy)}
                  className="mx-auto mb-3 block min-h-10 text-xs font-semibold text-primary underline underline-offset-4 disabled:opacity-50"
                >
                  {busy === "older" ? "Loading older messages…" : "Load older messages"}
                </button>
              )}
              <p className="mb-4 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-muted-foreground">
                <ShieldCheck size={14} aria-hidden="true" />
                Only you and your assigned support team can see this case conversation.
              </p>
              {!thread ? (
                <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                  {error ? "Conversation unavailable." : "Loading conversation…"}
                </p>
              ) : thread.messages.length ? (
                <ol className="flex flex-col gap-3">
                  {thread.messages.map((message) => (
                    <li
                      key={message.id}
                      className={`echo-message-bubble max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.sender === "user" ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "mr-auto rounded-bl-md bg-card text-foreground shadow-sm"}`}
                    >
                      <span className="sr-only">{message.sender === "user" ? "You" : "Professional"}: </span>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75">
                        <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
                        {message.sender === "user" && <Check size={12} aria-label="Saved" />}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="py-10 text-center">
                  <MessageCircle className="mx-auto mb-3 text-primary" size={28} aria-hidden="true" />
                  <p className="text-sm font-semibold">No messages in this case yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {canSend
                      ? "You can start a private case conversation below."
                      : "Messages will appear here when available."}
                  </p>
                </div>
              )}
              <div ref={bottom} />
            </div>
            {error && (
              <p role="alert" className="border-t border-danger/20 bg-danger/5 px-4 py-2 text-xs text-danger">
                {error}
              </p>
            )}
            {canSend ? (
              <form onSubmit={(event) => void send(event)} className="shrink-0 border-t border-border/70 bg-card p-3">
                <label htmlFor="user-case-message" className="sr-only">
                  Message your practitioner
                </label>
                <textarea
                  id="user-case-message"
                  rows={2}
                  maxLength={4000}
                  required
                  disabled={Boolean(busy)}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    clientMessageId.current = null;
                  }}
                  placeholder="Write a private case message"
                  className="min-h-[72px] w-full resize-none rounded-xl border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="max-w-[190px] text-[11px] leading-4 text-muted-foreground">
                    Messages aren’t monitored for emergencies.
                  </p>
                  <button
                    type="submit"
                    disabled={!draft.trim() || Boolean(busy)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground outline-none transition-[background-color,transform] hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97] disabled:opacity-50"
                  >
                    <Send size={15} aria-hidden="true" />
                    {busy === "send" ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            ) : (
              thread && (
                <p className="border-t border-border/70 bg-card px-4 py-3 text-xs text-muted-foreground">
                  This case is read-only. You can still review its messages.
                </p>
              )
            )}
          </>
        ) : (
          <div
            ref={listContainer}
            className="echo-message-view-enter echo-panel-scroll min-h-0 flex-1 overflow-y-auto p-4"
          >
            <p className="mb-3 text-sm leading-6 text-muted-foreground">
              Choose a support request to read and reply to your practitioner.
            </p>
            {loading || (requests === null && !error) ? (
              <div role="status" aria-busy="true" className="space-y-2">
                <span className="sr-only">Loading conversations</span>
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 rounded-2xl bg-secondary/60 motion-safe:animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div role="alert" className="rounded-2xl bg-danger/5 p-4 text-sm text-danger">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 font-semibold underline underline-offset-4"
                >
                  <RefreshCw size={16} />
                  Retry
                </button>
              </div>
            ) : requests?.length ? (
              <ul className="space-y-2">
                {requests.map((request) => (
                  <li key={request.id}>
                    <button
                      type="button"
                      data-request-id={request.id}
                      onClick={() => selectRequest(request.id)}
                      className="echo-message-row flex min-h-20 w-full items-center gap-3 rounded-2xl bg-card p-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] bg-secondary text-primary">
                        <MessageCircle size={19} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-semibold text-foreground">
                          {displayName(request)}
                        </strong>
                        <span className="mt-1 block text-xs capitalize text-muted-foreground">
                          {request.status} · Updated {messageTime(request.updatedAt)}
                        </span>
                      </span>
                      <ArrowRight size={17} className="shrink-0 text-primary" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-10 text-center">
                <MessageCircle className="mx-auto mb-3 text-primary" size={28} aria-hidden="true" />
                <h3 className="text-base font-semibold">No support conversations yet</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Messages become available when a practitioner is assigned to a support request.
                </p>
                <Link
                  href="/professional-support/requests"
                  onClick={onClose}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
                >
                  View my requests <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}
        <div className="shrink-0 border-t border-border/70 bg-card px-4 py-3 text-xs text-muted-foreground">
          <Link
            href="/professional-support/messages"
            onClick={onClose}
            className="inline-flex min-h-9 items-center gap-2 font-semibold text-primary underline underline-offset-4"
          >
            Open all messages <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </EchoSheet>
  );
}
