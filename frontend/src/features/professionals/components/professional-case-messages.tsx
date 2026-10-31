"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { professionalApi, type CaseMessage } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalPanel } from "./professional-ui";
import { requestDate } from "../professional-request.model";

/** Mounted only inside a currently authorized case; never loads other cases. */
export function ProfessionalCaseMessages({ caseId, readOnly, onFailure, active = true }: {
  caseId: string; readOnly: boolean; onFailure: (reason: unknown) => void; active?: boolean;
}) {
  const [messages, setMessages] = useState<CaseMessage[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const generation = useRef(0);
  const pending = useRef(false);
  const visible = useRef(active);
  useEffect(() => { visible.current = active; }, [active]);
  const failure = useRef(onFailure);
  failure.current = onFailure;
  const load = useCallback(async (before?: string) => {
    const current = ++generation.current;
    try {
      const result = await professionalApi.caseMessages(caseId, before);
      if (current !== generation.current) return;
      if (result.messages.some((item) => item.requestId !== caseId)) throw new Error("Case message scope could not be confirmed.");
      if (visible.current) await professionalApi.markCaseMessagesRead(caseId);
      if (current !== generation.current) return;
      setMessages((previous) => before ? [...result.messages, ...(previous ?? [])].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index) : result.messages);
      setCursor(result.nextCursor);
    } catch (reason) {
      if (current === generation.current) { setMessages(null); failure.current(reason); }
    }
  }, [caseId]);
  useEffect(() => { if (active && !pending.current) void load(); }, [active, load]);
  useEffect(() => () => { generation.current += 1; }, [caseId]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!visible.current || pending.current || readOnly || messages === null || draft.trim().length < 1 || draft.trim().length > 4000) return;
    pending.current = true; setBusy(true); setFeedback("");
    const current = generation.current;
    try {
      await professionalApi.sendCaseMessage(caseId, { clientMessageId: crypto.randomUUID(), body: draft.trim() });
      if (current !== generation.current) return;
      setDraft("");
      await load();
      if (current + 1 === generation.current) setFeedback("Message received by the server. Check the conversation below.");
    } catch (reason) {
      if (current === generation.current) { setMessages(null); failure.current(reason); }
    } finally { pending.current = false; setBusy(false); }
  }
  return <ProfessionalPanel title="Case messages" icon={MessageCircle} description="Messages between the request owner and their assigned professional. This is not a continuously monitored emergency channel.">
    {messages === null ? <p role="status" className="text-sm text-muted-foreground">Loading case messages</p> : <>
      {cursor ? <EchoButton variant="outline" className="mb-4 min-h-11" disabled={busy} onClick={() => { if (pending.current) return; pending.current = true; setBusy(true); void load(cursor).finally(() => { pending.current = false; setBusy(false); }); }}>Older messages</EchoButton> : null}
      <ul aria-label="Case conversation" className="space-y-3">{messages.map((item) => <li key={item.id} className="rounded-2xl border border-border bg-background p-4">
        <p className="text-xs font-semibold text-primary">{item.sender === "professional" ? "Professional" : "Request owner"}</p>
        <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-7">{item.body}</p>
        <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted-foreground">{requestDate(item.createdAt)}</time>
      </li>)}</ul>
      {messages.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">No messages in this case yet.</p> : null}
      {readOnly ? <p className="mt-4 text-sm text-muted-foreground">This conversation is read-only.</p> : <form onSubmit={(event) => void send(event)} className="mt-5 space-y-3">
        <label className="block text-sm font-semibold">Case message<textarea className="echo-input mt-2 min-h-28 w-full" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} disabled={busy} required /></label>
        <EchoButton type="submit" className="min-h-11" disabled={busy || !draft.trim()} isLoading={busy} loadingText="Sending message">Send message</EchoButton>
      </form>}
      {feedback ? <p role="status" className="mt-3 text-sm text-primary">{feedback}</p> : null}
    </>}
  </ProfessionalPanel>;
}
