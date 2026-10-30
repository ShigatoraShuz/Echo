"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, BookOpen, HeartHandshake, History, LockKeyhole, Mic, MicOff, MoreHorizontal, Pencil, Pin, Plus, Send, ShieldAlert, Sparkles, Volume2, VolumeX, Wind } from "lucide-react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { useBuddyVoiceControls } from "../view-model/use-buddy-voice-controls";
import { BuddyChatBubble } from "../components/buddy-chat-bubble";
import { BuddyAnalysisHandoff } from "../components/buddy-analysis-handoff";
import { DefaultJournalFilters, type JournalEntry } from "@/features/journal/model/journal.model";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion";
import { BuddyEmptyState } from "../components/buddy-empty-state";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { EchoSheet } from "@/shared/components/ui/echo-sheet";
import type { BuddyConversation } from "../model/buddy.model";
import { PROMPT_CHIPS } from "../model/buddy.constants";

export function BuddyView() {
  const vm = useBuddyViewModel();
  const reducedMotion = usePrefersReducedMotion();
  const voice = useBuddyVoiceControls();
  const [mode,setMode]=useState<'chat'|'talk'>('chat');
  const speakNext=useRef(false);
  const [draft, setDraft] = useState("");
  const [recentJournal, setRecentJournal] = useState<JournalEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<BuddyConversation | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const initialMessageIds = useRef(new Set<string>());
  const historyReady = useRef(false);
  const latestBuddyReply = [...vm.messages].reverse().find((message) => message.role === "buddy")?.content ?? "";
  useEffect(()=>{if(mode==='talk'&&speakNext.current&&!vm.isSending&&latestBuddyReply){speakNext.current=false;void voice.speak(latestBuddyReply);}},[mode,vm.isSending,latestBuddyReply]);
  const { accessStatus, selectConversation, clearConversation } = vm;
  const activeConversation = vm.conversations.find((conversation) => conversation.id === vm.activeConversationId);
  const savedChatReadOnly = Boolean(vm.activeConversationId && !vm.historyEnabled);
  const pinsAvailable = vm.pagination.pinsAvailable !== false;

  useEffect(() => {
    if (accessStatus !== "allowed") return;
    const syncFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get("conversation");
      if (id) void selectConversation(id);
      else clearConversation();
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [accessStatus, selectConversation, clearConversation]);

  useEffect(() => {
    if (!vm.activeConversationId || !vm.historyEnabled) return;
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (id !== vm.activeConversationId) {
      window.history.replaceState(null, "", `/buddy?conversation=${encodeURIComponent(vm.activeConversationId)}`);
    }
  }, [vm.activeConversationId, vm.historyEnabled]);

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

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = Math.min(composer.scrollHeight, 144) + "px";
  }, [draft]);

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
    speakNext.current=mode==="talk";
    if (await vm.sendMessage(vm.activeConversationId, content)) setDraft("");else speakNext.current=false;
  }

  function openConversation(id: string) {
    voice.cancel();speakNext.current=false;
    if (id === vm.activeConversationId) return;
    setHistoryOpen(false);
    setActionsId(null);
    window.history.pushState(null, "", `/buddy?conversation=${encodeURIComponent(id)}`);
    void vm.selectConversation(id);
  }

  function startConversation() {
    setHistoryOpen(false);
    setActionsId(null);
    window.history.replaceState(null, "", "/buddy");
    void vm.createConversation();
  }

  function openRename(conversation: BuddyConversation) {
    if (historyOpen) {
      setHistoryOpen(false);
      window.setTimeout(() => {
        setRenameTarget(conversation);
        setRenameTitle(conversation.title);
      }, reducedMotion ? 0 : 190);
      return;
    }
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

  const pinnedConversations = pinsAvailable ? vm.conversations.filter((conversation) => conversation.pinnedAt) : [];
  const recentConversations = vm.conversations.filter((conversation) => !conversation.pinnedAt || !pinsAvailable);

  function renderHistoryPanel(mobile: boolean) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={startConversation}
          className="mx-3 mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-[var(--landing-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--landing-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-primary)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New conversation
        </button>
        <nav aria-label={mobile ? "Mobile conversation history" : "Conversation history"} className="echo-panel-scroll min-h-0 flex-1 overflow-y-auto px-3 py-5">
          {vm.isLoadingList && <p role="status" className="px-2 text-sm text-[var(--landing-muted)]">Loading conversations…</p>}
          {!vm.isLoadingList && vm.conversations.length === 0 && (
            <p className="px-2 text-sm leading-6 text-[var(--landing-muted)]">Your saved conversations will appear here.</p>
          )}
          {[
            { title: "Pinned chats", items: pinnedConversations },
            { title: "Recent chats", items: recentConversations },
          ].filter((group) => group.items.length > 0).map((group) => (
            <section key={group.title} aria-label={group.title} className="mb-5">
              <h2 className="px-2 pb-2 text-xs font-semibold text-[var(--landing-primary)]">{group.title}</h2>
              <div className="space-y-1">
                {group.items.map((conversation) => (
                  <div key={conversation.id} className="rounded-xl">
                    <div className={"flex items-center rounded-xl transition-colors " + (vm.activeConversationId === conversation.id ? "bg-[var(--landing-sage-soft)]" : "hover:bg-white/75")}>
                      <button
                        type="button"
                        onClick={() => openConversation(conversation.id)}
                        aria-current={vm.activeConversationId === conversation.id ? "page" : undefined}
                        className="min-h-12 min-w-0 flex-1 px-3 py-2 text-left outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]"
                      >
                        <span className="block truncate text-sm font-semibold text-[var(--landing-ink)]">{conversation.title}</span>
                        <span className="block truncate text-xs text-[var(--landing-muted)]">{conversation.lastMessage || "No messages yet"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionsId((current) => current === conversation.id ? null : conversation.id)}
                        aria-label={"Actions for " + conversation.title}
                        aria-expanded={actionsId === conversation.id}
                        className="mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--landing-primary)] outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    {actionsId === conversation.id && (
                      <div className="flex gap-1 px-1 pb-1 pt-1">
                        <button type="button" onClick={() => openRename(conversation)} className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-semibold text-[var(--landing-primary)] hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]">
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Rename
                        </button>
                        {pinsAvailable && (
                          <button type="button" onClick={() => void vm.pinConversation(conversation.id, !conversation.pinnedAt)} aria-label={(conversation.pinnedAt ? "Unpin " : "Pin ") + conversation.title} className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-semibold text-[var(--landing-primary)] hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]">
                            <Pin className="h-3.5 w-3.5" fill={conversation.pinnedAt ? "currentColor" : "none"} aria-hidden="true" />
                            {conversation.pinnedAt ? "Unpin" : "Pin"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
          {vm.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-[var(--landing-muted)]">
              <button type="button" disabled={vm.pagination.page <= 1 || vm.isLoadingList} onClick={() => void vm.loadConversations(vm.pagination.page - 1)} className="min-h-11 rounded-lg px-2 font-semibold text-[var(--landing-primary)] disabled:opacity-40">Previous</button>
              <span>{vm.pagination.page} of {vm.pagination.totalPages}</span>
              <button type="button" disabled={vm.pagination.page >= vm.pagination.totalPages || vm.isLoadingList} onClick={() => void vm.loadConversations(vm.pagination.page + 1)} className="min-h-11 rounded-lg px-2 font-semibold text-[var(--landing-primary)] disabled:opacity-40">Next</button>
            </div>
          )}
          {!pinsAvailable && <p className="px-2 pt-3 text-xs text-[var(--landing-muted)]">Pinning is temporarily unavailable.</p>}
        </nav>
        <div className="shrink-0 border-t border-[var(--landing-primary-10)] px-3 py-3">
          <Link href="/buddy/history" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--landing-primary)] hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]">
            <History className="h-4 w-4" aria-hidden="true" /> Search all history
          </Link>
          {recentJournal && (
            <Link href={"/journal/" + encodeURIComponent(recentJournal.id)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-[var(--landing-ink)] hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]">
              <BookOpen className="h-4 w-4 shrink-0 text-[var(--landing-primary)]" aria-hidden="true" />
              <span className="truncate">Journal: {recentJournal.title}</span>
            </Link>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--landing-primary-10)] px-3 pt-3 text-xs font-medium">
            <Link href="/tools/grounding" className="inline-flex min-h-10 items-center gap-1 text-[var(--landing-primary)] hover:underline"><Wind className="h-3.5 w-3.5" aria-hidden="true" /> Grounding</Link>
            <Link href="/support/find-help" className="inline-flex min-h-10 items-center gap-1 text-[var(--landing-primary)] hover:underline"><HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" /> Find help</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-5.25rem)] min-h-[360px] min-w-0 overflow-hidden rounded-[1.2rem] border border-[var(--landing-primary-10)] bg-[#fffdf8] shadow-[0_18px_48px_rgba(30,53,34,0.07)] lg:h-full lg:min-h-0">
      <aside aria-label="Buddy conversations" className="hidden min-h-0 w-60 shrink-0 flex-col border-r border-[var(--landing-primary-10)] bg-[#f3f5ee] lg:flex xl:w-72">
        <div className="border-b border-[var(--landing-primary-10)] px-5 py-5">
          <p className="font-[family-name:var(--font-echo-display)] text-2xl text-[var(--landing-ink)]">Buddy</p>
          <p className="mt-1 text-xs text-[var(--landing-muted)]">A quiet place to reflect.</p>
        </div>
        {renderHistoryPanel(false)}
      </aside>

      <section aria-label="Buddy chat" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center gap-1 border-b border-[var(--landing-primary-10)] px-2 sm:px-4">
          <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Open conversation history" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--landing-primary)] outline-none hover:bg-[var(--landing-sage-soft)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)] lg:hidden">
            <History className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 px-1 sm:px-2">
            <h1 className="truncate text-sm font-semibold text-[var(--landing-ink)] sm:text-base">{activeConversation?.title ?? (vm.activeConversationId ? "Conversation" : "New conversation")}</h1>
            <p className="truncate text-[11px] text-[var(--landing-muted)]">Buddy · reflective support</p>
          </div>
          <button type="button" onClick={startConversation} aria-label="New conversation" title="New conversation" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--landing-primary)] outline-none hover:bg-[var(--landing-sage-soft)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link href="/crisis" aria-label="Crisis support" title="Crisis support" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-danger outline-none hover:bg-crisis-soft focus-visible:ring-2 focus-visible:ring-danger">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </Link>
        </header>

        <BuddyAnalysisHandoff onChoose={setDraft} />

        <div
          ref={conversationScrollRef}
          role="log"
          aria-label="Conversation messages"
          aria-busy={vm.isLoadingMessages || vm.isSending}
          className="echo-panel-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-3xl space-y-5">
            {vm.isLoadingMessages && vm.messages.length === 0 && <p role="status" className="py-16 text-center text-sm text-[var(--landing-muted)]">Opening your private conversation…</p>}
            {!vm.isLoadingMessages && vm.messages.length === 0 && <BuddyEmptyState onPromptSelect={setDraft} />}
            {vm.messages.map((message) => (
              <div key={message.id} className={historyReady.current && !initialMessageIds.current.has(message.id) ? "echo-buddy-message-enter" : undefined}>
                <BuddyChatBubble message={message} />
              </div>
            ))}
            {vm.isSending && <p className="pl-2 text-xs font-medium text-[var(--landing-muted)]">Buddy is reflecting…</p>}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--landing-primary-10)] bg-[#fffdf8] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div role="group" aria-label="Buddy conversation mode" className="mb-2 inline-flex gap-1 rounded-full border border-[var(--landing-primary-20)] bg-white p-1">{(['chat','talk'] as const).map(value=><button type="button" key={value} className={`min-h-11 rounded-full px-5 text-sm font-semibold ${mode===value?"bg-[var(--landing-primary)] text-white":"text-[var(--landing-primary)]"}`} aria-pressed={mode===value} onClick={()=>{voice.cancel();speakNext.current=false;setMode(value);}}>{value==='chat'?'Chat':'Talk'}</button>)}</div><p className="mb-2 text-xs text-[var(--landing-muted)]">{mode==='talk'?'Record a message, then stop to send. Buddy will read the reply aloud.':'Type a message. Your conversation continues when you switch modes.'}</p>
            {voice.isTranscribing&&<p role="status">Transcribing locally...</p>}
            {mode==='talk'&&(voice.isTranscribing||voice.isSpeaking||vm.isSending)&&<button type="button" onClick={()=>{speakNext.current=false;voice.cancel();}}>Cancel voice</button>}
            {showPrompts && (
              <div aria-label="Prompt ideas" className="echo-panel-scroll mb-2 flex gap-2 overflow-x-auto pb-1">
                {PROMPT_CHIPS.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => { setDraft(prompt); setShowPrompts(false); composerRef.current?.focus(); }} className="min-h-11 shrink-0 rounded-full border border-[var(--landing-primary-20)] bg-white px-3 text-xs font-medium text-[var(--landing-primary)] hover:bg-[var(--landing-sage-soft)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]">
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            {!vm.historyEnabled && <p className="mb-2 text-xs text-[var(--landing-muted)]">{savedChatReadOnly ? "Saved chats are read-only while history saving is off. Turn it on in Privacy settings to continue this chat." : "Temporary chat: messages disappear when you leave or refresh this page."}</p>}
            {voice.interimTranscript && <p role="status" className="mb-2 text-xs text-[var(--landing-primary)]">Transcript: {voice.interimTranscript}</p>}
            <div className="rounded-[1.35rem] border border-[var(--landing-primary-20)] bg-white px-3 py-2 shadow-[0_8px_24px_rgba(30,53,34,0.06)] focus-within:border-[var(--landing-primary)] focus-within:ring-2 focus-within:ring-[var(--landing-primary-10)]">
              <textarea
                ref={composerRef}
                rows={1}
                value={draft}
                disabled={savedChatReadOnly}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                className="block min-h-10 max-h-36 w-full resize-none overflow-y-auto bg-transparent px-1 py-2 text-base leading-6 text-[var(--landing-ink)] outline-none placeholder:text-[var(--landing-muted)]"
                placeholder="Message Buddy..."
                aria-label="Message Buddy"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (voice.isListening) voice.stopListening();
                    else void voice.startListening(async(transcript)=>{setDraft(transcript);speakNext.current=true;const ok=await vm.sendMessage(vm.activeConversationId,transcript);if(ok)setDraft('');else speakNext.current=false;});
                  }}
                  disabled={mode!=="talk" || !voice.voiceSupported || voice.isTranscribing || vm.isSending || savedChatReadOnly}
                  aria-label={voice.isListening ? "Stop voice input" : "Start voice input"}
                  className="grid h-11 w-11 place-items-center rounded-full text-[var(--landing-primary)] outline-none hover:bg-[var(--landing-sage-soft)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)] disabled:opacity-40"
                >
                  {voice.isListening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => voice.isSpeaking ? voice.stopSpeaking() : voice.speak(latestBuddyReply)}
                  disabled={!voice.speechSupported || !latestBuddyReply}
                  aria-label={voice.isSpeaking ? "Stop speaking Buddy reply" : "Speak latest Buddy reply"}
                  className="grid h-11 w-11 place-items-center rounded-full text-[var(--landing-primary)] outline-none hover:bg-[var(--landing-sage-soft)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)] disabled:opacity-40"
                >
                  {voice.isSpeaking ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button type="button" onClick={() => setShowPrompts((current) => !current)} aria-label={showPrompts ? "Hide prompt ideas" : "Show prompt ideas"} aria-expanded={showPrompts} className="grid h-11 w-11 place-items-center rounded-full text-[var(--landing-primary)] outline-none hover:bg-[var(--landing-sage-soft)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="ml-1 hidden text-[11px] text-[var(--landing-muted)] sm:inline">Reflective support, not emergency care</span>
                <button type="button" onClick={() => void handleSend()} disabled={!draft.trim() || vm.isSending || savedChatReadOnly} aria-label="Send message" className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--landing-primary)] text-white outline-none transition-colors hover:bg-[var(--landing-primary-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--landing-primary)] disabled:opacity-40">
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {voice.voiceError && <p role="status" className="mt-2 text-xs text-[var(--landing-muted)]">{voice.voiceError}</p>}
            {vm.error && (
              <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-danger">
                <span>{vm.error}</span>
                {!vm.activeConversationId && !vm.isLoadingList && <button type="button" onClick={() => void vm.loadConversations()} className="min-h-10 rounded-lg px-2 font-semibold underline">Retry history</button>}
              </div>
            )}
          </div>
        </div>
      </section>

      <EchoSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Your conversations" description="Open a saved chat or start a new one." side="left" className="max-w-sm bg-[#f3f5ee]">
        {renderHistoryPanel(true)}
      </EchoSheet>
      <EchoDialog open={Boolean(renameTarget)} onClose={() => { if (!renaming) setRenameTarget(null); }} title="Rename conversation" description="Choose a title that will help you find this conversation again.">
        {vm.error && <p role="alert" className="mb-3 text-sm text-danger">{vm.error}</p>}
        <label className="block text-sm font-medium">Conversation title<input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} maxLength={100} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={renaming} onClick={() => setRenameTarget(null)} className="rounded-full border border-border px-4 py-2">Cancel</button><button type="button" disabled={renaming || !renameTitle.trim()} onClick={() => void saveRename()} className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{renaming ? "Saving…" : "Save"}</button></div>
      </EchoDialog>
    </div>
  );
}
