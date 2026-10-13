"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BadgeCheck, BookOpen, Bot, HeartHandshake, History, LockKeyhole, Mic, MicOff, Pencil, Pin, Plus, Send, ShieldAlert, Sparkles, Volume2, VolumeX, Wind } from "lucide-react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { useBuddyVoiceControls } from "../view-model/use-buddy-voice-controls";
import { BuddyChatBubble } from "../components/buddy-chat-bubble";
import { BuddyAnalysisHandoff } from "../components/buddy-analysis-handoff";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { DefaultJournalFilters, type JournalEntry } from "@/features/journal/model/journal.model";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion";
import { BuddyEmptyState } from "../components/buddy-empty-state";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import type { BuddyConversation } from "../model/buddy.model";

const promptChips = [
  "Help me untangle a thought",
  "Guide a two-minute grounding",
  "Reflect on today",
  "Plan a gentle next step",
];

export function BuddyView() {
  const vm = useBuddyViewModel();
  const reducedMotion = usePrefersReducedMotion();
  const voice = useBuddyVoiceControls();
  const [draft, setDraft] = useState("");
  const [recentJournal, setRecentJournal] = useState<JournalEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<BuddyConversation | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const initialMessageIds = useRef(new Set<string>());
  const historyReady = useRef(false);
  const openedFromHistory = useRef(false);
  const latestBuddyReply = [...vm.messages].reverse().find((message) => message.role === "buddy")?.content ?? "";
  const { accessStatus, selectConversation } = vm;
  const savedChatReadOnly = Boolean(vm.activeConversationId && !vm.historyEnabled);
  const pinsAvailable = vm.pagination.pinsAvailable !== false;

  useEffect(() => {
    if (openedFromHistory.current || accessStatus !== "allowed") return;
    openedFromHistory.current = true;
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (id) void selectConversation(id);
  }, [accessStatus, selectConversation]);

  useEffect(() => {
    const controller = new AbortController();
    void getJournalService().listEntries(DefaultJournalFilters, 1, 1, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.success) setRecentJournal(result.data.entries[0] ?? null);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (vm.accessStatus !== "allowed" || vm.isLoadingMessages || historyReady.current) return;
    vm.messages.forEach((message) => initialMessageIds.current.add(message.id));
    historyReady.current = true;
  }, [vm.accessStatus, vm.isLoadingMessages, vm.messages]);

  useEffect(() => {
    const panel = conversationScrollRef.current;
    if (!panel) return;
    if (typeof panel.scrollTo === "function") panel.scrollTo({ top: panel.scrollHeight, behavior: reducedMotion ? "instant" : "smooth" });
    else panel.scrollTop = panel.scrollHeight;
  }, [vm.messages, reducedMotion]);

  if (vm.accessStatus === "loading") {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-card/70" />;
  }

  if (vm.accessStatus !== "allowed") {
    const needsContact = vm.accessStatus === "trusted_contact";
    const failed = vm.accessStatus === "error";
    return (
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(130deg,rgba(251,247,238,0.97),rgba(220,232,214,0.78))] p-7 text-center shadow-card sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--landing-primary)] text-white shadow-subtle">
          <LockKeyhole className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)]">Buddy access</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.04em] text-[var(--landing-ink)] sm:text-5xl">{failed ? "Buddy access could not be checked." : needsContact ? "Add a trusted support contact." : "Verify before opening Buddy."}</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--landing-muted)]">{failed ? vm.error ?? "Please try again shortly." : needsContact ? "Your account is verified. Buddy also requires a valid Trusted Support Contact with their permission recorded in Settings." : "Buddy needs approved account verification and a valid Trusted Support Contact with their permission recorded in Settings."}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {!failed ? <Link href="/settings/trusted-contacts" className="echo-button-secondary rounded-full">Review trusted support</Link> : null}
          {!failed && !needsContact ? <Link href="/settings/verification" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--landing-primary)] px-6 text-sm font-bold text-white transition-[background-color,transform] hover:bg-[var(--landing-primary-hover)] active:scale-[0.97]">
            <BadgeCheck className="h-4 w-4" /> Open verification
          </Link> : null}
          <Link href="/tools/grounding" className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--landing-primary-20)] bg-white/60 px-6 text-sm font-bold text-[var(--landing-primary)] transition-transform active:scale-[0.97]">Use grounding tools</Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Crisis and public support resources remain available without verification.</p>
      </div>
    );
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || vm.isSending || savedChatReadOnly) return;
    if (await vm.sendMessage(vm.activeConversationId, content)) setDraft("");
  }

  function openRename(conversation: BuddyConversation) {
    setRenameTarget(conversation);
    setRenameTitle(conversation.title);
  }

  async function saveRename() {
    if (!renameTarget || !renameTitle.trim() || renaming) return;
    setRenaming(true);
    const saved = await vm.renameConversation(renameTarget.id, renameTitle.trim());
    setRenaming(false);
    if (saved) setRenameTarget(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:h-full lg:min-h-0">
      <BuddyAnalysisHandoff onChoose={setDraft} />
      <EchoMotionSurface as="div" tilt={false} className="echo-workspace-enter relative shrink-0 overflow-hidden rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(120deg,rgba(251,247,238,0.96),rgba(220,232,214,0.74))] p-4 shadow-[0_18px_50px_rgba(30,53,34,0.08)]">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/60 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-[var(--landing-primary)]">Reflective Buddy</p>
            <h1 className="mt-1 text-[1.9rem] font-medium leading-tight tracking-[-0.04em] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">Talk it through gently.</h1>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--landing-muted)]">A private place to name what feels present, find steadier ground, and choose one small next step.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => { window.history.replaceState(null, "", "/buddy"); void vm.createConversation(); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--landing-primary)] px-5 text-sm font-bold text-white focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]">
              <Plus className="h-4 w-4" aria-hidden="true" />New conversation
            </button>
            <Link href="/buddy/history" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--landing-primary-20)] bg-[var(--landing-cream-70)] px-5 text-sm font-bold text-[var(--landing-primary)] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97]">
              <History className="h-4 w-4" aria-hidden="true" />
              Reflection history
            </Link>
          </div>
        </div>
      </EchoMotionSurface>

      <div className="echo-card-motion-grid grid min-w-0 gap-3 lg:min-h-[420px] lg:flex-1 lg:grid-cols-[minmax(0,72fr)_minmax(270px,28fr)]">
        <EchoMotionSurface
          tilt={false}
          className="echo-workspace-enter flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-[rgba(255,253,247,0.88)] shadow-[0_20px_54px_rgba(30,53,34,0.08)] backdrop-blur-sm lg:min-h-0"
        >
          <div className="flex items-center justify-between gap-4 bg-[var(--landing-footer)] px-5 py-4 text-[var(--landing-inverse)] sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold tracking-[-0.025em]">Quiet conversation room</h2>
                <p className="mt-0.5 text-xs text-[var(--landing-inverse-80)]">Listen, type, or speak. No diagnosis.</p>
              </div>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9dcc9f]" />
              Private session
            </span>
          </div>

            <div className="relative flex min-h-0 flex-col p-3 sm:p-4 lg:flex-1">
              <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-2/3 -translate-x-1/2 rounded-full bg-[var(--landing-sage-soft)]/35 blur-3xl" aria-hidden="true" />
            <div ref={conversationScrollRef} className="echo-panel-scroll relative min-h-[280px] max-h-[60dvh] space-y-5 overflow-y-auto rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-white/35 p-3 sm:max-h-[65dvh] sm:p-5 lg:max-h-none lg:min-h-0 lg:flex-1" tabIndex={0} aria-label="Conversation messages" aria-live="polite" aria-busy={vm.isLoadingMessages || vm.isSending}>
              {vm.isLoadingMessages && vm.messages.length === 0 ? (
                <p className="py-16 text-center text-sm text-[var(--landing-muted)]">Opening your private conversation…</p>
              ) : null}
              {!vm.isLoadingMessages && vm.messages.length === 0 ? (
                <BuddyEmptyState onPromptSelect={setDraft} />
              ) : null}
              {vm.messages.map((message) => (
                <div key={message.id} className={historyReady.current && !initialMessageIds.current.has(message.id) ? "echo-buddy-message-enter" : undefined}>
                  <BuddyChatBubble message={message} />
                </div>
              ))}
              {vm.isSending ? (
                <p className="pl-14 text-xs font-medium text-[var(--landing-muted)]">Buddy is reflecting…</p>
              ) : null}
            </div>

            <div className="mt-3 shrink-0 rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-white/82 p-3 shadow-[0_12px_30px_rgba(30,53,34,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur focus-within:border-[var(--landing-primary-40)] focus-within:ring-4 focus-within:ring-[var(--landing-primary-10)]">
              {!vm.historyEnabled ? <p className="mb-2 text-xs text-[var(--landing-muted)]">{savedChatReadOnly ? "Saved chats are read-only while history saving is off. Turn it on in Privacy settings to continue this chat." : "Temporary chat: messages disappear when you leave or refresh this page."}</p> : null}
              {voice.interimTranscript ? (
                <p className="mb-2 rounded-full bg-[var(--landing-sage-soft)]/70 px-3 py-1.5 text-xs font-medium text-[var(--landing-primary)]">
                  Listening: {voice.interimTranscript}
                </p>
              ) : null}
              <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={() => {
                  if (voice.isListening) {
                    voice.stopListening();
                  } else {
                    voice.startListening((transcript) => {
                      setDraft((current) => `${current}${current.trim() ? " " : ""}${transcript}`);
                    });
                  }
                }}
                disabled={!voice.voiceSupported || vm.isSending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] text-[var(--landing-primary)] outline-none transition-[background-color,transform] hover:bg-[var(--landing-sage-soft)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={voice.isListening ? "Stop voice input" : "Start voice input"}
              >
                {voice.isListening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
              </button>
              <textarea
                value={draft}
                disabled={savedChatReadOnly}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                className="order-first min-h-12 w-full flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-6 text-[var(--landing-ink)] outline-none placeholder:text-[var(--landing-muted)] sm:order-none sm:w-auto"
                placeholder="Tell Buddy what feels present..."
                aria-label="Message Buddy"
              />
              <button
                type="button"
                onClick={() => {
                  if (voice.isSpeaking) voice.stopSpeaking();
                  else voice.speak(latestBuddyReply);
                }}
                disabled={!voice.speechSupported || !latestBuddyReply}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--landing-primary-15)] bg-[var(--landing-cream)] text-[var(--landing-primary)] outline-none transition-[background-color,transform] hover:bg-[var(--landing-sage-soft)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={voice.isSpeaking ? "Stop speaking Buddy reply" : "Speak latest Buddy reply"}
              >
                {voice.isSpeaking ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button type="button" onClick={() => void handleSend()} disabled={!draft.trim() || vm.isSending || savedChatReadOnly} className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] outline-none transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] hover:shadow-[0_8px_18px_rgba(30,53,34,0.18)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 sm:ml-0" aria-label="Send message">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
              </div>
            </div>
            {voice.voiceError ? <p role="status" className="mt-2 text-xs font-medium text-[var(--landing-muted)]">{voice.voiceError}</p> : null}
            {vm.error ? <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-danger"><span>{vm.error}</span>{!vm.activeConversationId && !vm.isLoadingList ? <button type="button" onClick={() => void vm.loadConversations()} className="rounded-full border border-danger/30 px-3 py-1 text-xs font-bold outline-none hover:bg-crisis-soft focus-visible:ring-2 focus-visible:ring-danger">Retry history</button> : null}</div> : null}
          </div>
        </EchoMotionSurface>

        <aside className="echo-panel-scroll grid min-w-0 grid-cols-2 content-start gap-3 lg:min-h-0 lg:flex lg:flex-col lg:overflow-y-auto lg:pr-1" tabIndex={0} aria-label="Buddy shortcuts and history">
          {pinsAvailable ? <EchoMotionSurface tilt={false} className="echo-workspace-enter aspect-square overflow-y-auto rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(145deg,rgba(255,253,247,0.94),rgba(226,237,220,0.86))] p-3 shadow-[0_18px_44px_rgba(30,53,34,0.08)] sm:aspect-auto lg:shrink-0 lg:overflow-visible lg:p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-1 text-xs font-semibold text-[var(--landing-ink)] sm:text-base"><Pin size={15} className="hidden shrink-0 text-[var(--landing-primary)] sm:block"/>Pinned chats</h2>
              <Link href="/buddy/history" className="text-xs font-semibold text-[var(--landing-primary)]">See all</Link>
            </div>
            <div className="mt-4 space-y-1">{vm.conversations.filter((conversation) => conversation.pinnedAt).map((conversation) => <div key={conversation.id} className="flex items-center gap-2 rounded-xl bg-white/60 p-2"><button type="button" onClick={() => void vm.selectConversation(conversation.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--landing-ink)] hover:underline">{conversation.title}</button><button type="button" onClick={() => openRename(conversation)} aria-label={`Rename ${conversation.title}`} className="rounded-full p-2 text-[var(--landing-primary)] hover:bg-[var(--landing-sage-soft)]"><Pencil size={15}/></button><button type="button" onClick={() => void vm.pinConversation(conversation.id, false)} aria-label={`Unpin ${conversation.title}`} className="rounded-full p-2 text-[var(--landing-primary)] hover:bg-[var(--landing-sage-soft)]"><Pin size={15} fill="currentColor"/></button></div>)}{!vm.conversations.some((conversation) => conversation.pinnedAt) && <p className="text-sm text-[var(--landing-muted)]">Pin a conversation from History to keep it here.</p>}</div>
          </EchoMotionSurface> : null}

          <EchoMotionSurface tilt={false} className="echo-workspace-enter aspect-square overflow-y-auto rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-white/90 p-3 shadow-sm sm:aspect-auto lg:shrink-0 lg:overflow-visible lg:p-4">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-1 text-xs font-semibold text-[var(--landing-ink)] sm:text-base"><History size={15} className="hidden shrink-0 text-[var(--landing-primary)] sm:block"/>History</h2><Link href="/buddy/history" className="text-xs font-semibold text-[var(--landing-primary)]">See all</Link></div>
            <div className="mt-3 space-y-1">{vm.conversations.slice(0, 4).map((conversation) => <div key={conversation.id} className="flex items-center gap-2 rounded-xl border-b border-[var(--landing-primary-10)] py-2"><button type="button" onClick={() => void vm.selectConversation(conversation.id)} aria-current={vm.activeConversationId === conversation.id ? "true" : undefined} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium text-[var(--landing-ink)]">{conversation.title}</span><span className="block truncate text-xs text-[var(--landing-muted)]">{conversation.lastMessage || "No messages yet"}</span><span className="text-xs text-[var(--landing-muted)]">{conversation.lastMessageAt}</span></button><button type="button" onClick={() => openRename(conversation)} aria-label={`Rename ${conversation.title}`} className="rounded-full p-2 text-[var(--landing-primary)] hover:bg-[var(--landing-sage-soft)]"><Pencil size={15}/></button>{pinsAvailable ? <button type="button" onClick={() => void vm.pinConversation(conversation.id, !conversation.pinnedAt)} aria-label={`${conversation.pinnedAt ? "Unpin" : "Pin"} ${conversation.title}`} className="rounded-full p-2 text-[var(--landing-primary)] hover:bg-[var(--landing-sage-soft)]"><Pin size={15} fill={conversation.pinnedAt ? "currentColor" : "none"}/></button> : null}</div>)}{vm.conversations.length === 0 && <p className="text-sm text-[var(--landing-muted)]">Your conversations will appear here.</p>}{!pinsAvailable ? <p className="pt-2 text-xs text-[var(--landing-muted)]">Pinning is temporarily unavailable.</p> : null}</div>
          </EchoMotionSurface>

          <EchoMotionSurface tilt={false} className="col-span-2 rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-white/90 p-4 shadow-sm lg:col-span-1 lg:shrink-0"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--landing-ink)]"><BookOpen size={18} className="text-[var(--landing-primary)]"/>From your journal</h2><Link href="/journal" className="text-xs font-semibold text-[var(--landing-primary)]">See all</Link></div>{recentJournal ? <Link href={`/journal/${encodeURIComponent(recentJournal.id)}`} className="mt-3 block rounded-xl bg-[var(--landing-cream)] p-3 text-sm text-[var(--landing-ink)]"><span className="font-semibold">{recentJournal.title}</span><span className="mt-1 block line-clamp-2 text-xs text-[var(--landing-muted)]">{recentJournal.excerpt || recentJournal.body}</span></Link> : <p className="mt-3 text-sm text-[var(--landing-muted)]">Your recent reflection will appear here.</p>}</EchoMotionSurface>

          <EchoMotionSurface tilt={false} className="col-span-2 rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-white/90 p-4 shadow-sm lg:col-span-1 lg:shrink-0"><h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--landing-ink)]"><Sparkles size={18} className="text-[var(--landing-primary)]"/>Suggested prompts</h2><div className="mt-3 space-y-1">{promptChips.map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)} className="block w-full rounded-xl border-b border-[var(--landing-primary-10)] p-2 text-left text-sm text-[var(--landing-muted)] hover:bg-[var(--landing-sage-soft)] hover:text-[var(--landing-primary)]">{prompt}</button>)}</div></EchoMotionSurface>

          <EchoMotionSurface tilt={false} className="col-span-2 rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-[rgba(255,253,247,0.88)] p-4 shadow-[0_18px_44px_rgba(30,53,34,0.07)] lg:col-span-1 lg:shrink-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[var(--landing-primary)]">Support that stays close</p>
            <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">Helpful tools</h2>
            <div className="mt-5 grid gap-3">
              <Link href="/tools/grounding" className="group flex items-center gap-3 rounded-2xl border border-[var(--landing-primary-10)] bg-[var(--landing-sage-soft)]/55 p-4 outline-none transition-[background-color,transform] duration-150 ease-out hover:translate-x-0.5 hover:bg-[var(--landing-sage-soft)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-[var(--landing-primary)]">
                  <Wind className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-[var(--landing-ink)]">Start grounding</span>
                <ArrowUpRight className="h-4 w-4 text-[var(--landing-primary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </Link>
              <Link href="/support/find-help" className="group flex items-center gap-3 rounded-2xl border border-[var(--landing-primary-10)] bg-[var(--landing-cream)] p-4 outline-none transition-[background-color,transform] duration-150 ease-out hover:translate-x-0.5 hover:bg-white focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--landing-sage-soft)] text-[var(--landing-primary)]">
                  <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-[var(--landing-ink)]">Find support</span>
                <ArrowUpRight className="h-4 w-4 text-[var(--landing-primary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </Link>
              <Link href="/crisis" className="group flex items-center gap-3 rounded-2xl border border-danger/25 bg-crisis-soft/80 p-4 outline-none transition-[background-color,transform] duration-150 ease-out hover:translate-x-0.5 hover:bg-crisis-soft focus-visible:ring-4 focus-visible:ring-danger/15 active:scale-[0.98]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/60 text-danger">
                  <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-[var(--landing-ink)]">Crisis support</span>
                <ArrowUpRight className="h-4 w-4 text-danger transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </Link>
            </div>
          </EchoMotionSurface>

          <EchoMotionSurface tilt={false} className="col-span-2 rounded-[1.5rem] border border-white/10 bg-[var(--landing-footer)] p-4 text-[var(--landing-inverse)] shadow-[0_18px_44px_rgba(16,39,24,0.16)] lg:col-span-1 lg:shrink-0">
            <LockKeyhole className="h-5 w-5 text-[#a9d0a2]" aria-hidden="true" />
            <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/55">Private by design</p>
            <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] [font-family:var(--font-echo-display)]">Your conversation stays yours.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--landing-inverse-80)]">ECHO is a reflective support tool, not a diagnostic service.</p>
          </EchoMotionSurface>
        </aside>
      </div>
      <EchoDialog open={Boolean(renameTarget)} onClose={() => { if (!renaming) setRenameTarget(null); }} title="Rename conversation" description="Choose a title that will help you find this conversation again.">
        {vm.error && <p role="alert" className="mb-3 text-sm text-danger">{vm.error}</p>}
        <label className="block text-sm font-medium">Conversation title<input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} maxLength={100} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={renaming} onClick={() => setRenameTarget(null)} className="rounded-full border border-border px-4 py-2">Cancel</button><button type="button" disabled={renaming || !renameTitle.trim()} onClick={() => void saveRename()} className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{renaming ? "Saving…" : "Save"}</button></div>
      </EchoDialog>
    </div>
  );
}
