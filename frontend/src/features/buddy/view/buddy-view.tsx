"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BadgeCheck, Bot, HeartHandshake, History, LockKeyhole, Mic, MicOff, Send, ShieldAlert, Sparkles, Volume2, VolumeX, Wind } from "lucide-react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { useBuddyVoiceControls } from "../view-model/use-buddy-voice-controls";
import { BuddyChatBubble } from "../components/buddy-chat-bubble";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";

const promptChips = [
  "Help me untangle a thought",
  "Guide a two-minute grounding",
  "Reflect on today",
  "Plan a gentle next step",
];

export function BuddyView() {
  const vm = useBuddyViewModel();
  const { activeConversationId, selectConversation } = vm;
  const voice = useBuddyVoiceControls();
  const [draft, setDraft] = useState("");
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const latestBuddyReply = [...vm.messages].reverse().find((message) => message.role === "buddy")?.content ?? "";

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [vm.messages]);

  useEffect(() => {
    const requestedConversationId = new URLSearchParams(window.location.search).get("conversationId");
    if (requestedConversationId && requestedConversationId !== activeConversationId) {
      void selectConversation(requestedConversationId);
    }
  }, [activeConversationId, selectConversation]);

  if (vm.accessStatus === "loading") {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-card/70" />;
  }

  if (vm.accessStatus === "blocked") {
    return (
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(130deg,rgba(251,247,238,0.97),rgba(220,232,214,0.78))] p-7 text-center shadow-card sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--landing-primary)] text-white shadow-subtle">
          <LockKeyhole className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)]">Identity and age assurance</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.04em] text-[var(--landing-ink)] sm:text-5xl">Verify before opening Buddy.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--landing-muted)]">Buddy and AI-supported features are available to eligible adult accounts after an administrator approves account verification.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/settings/verification" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--landing-primary)] px-6 text-sm font-bold text-white transition-[background-color,transform] hover:bg-[var(--landing-primary-hover)] active:scale-[0.97]">
            <BadgeCheck className="h-4 w-4" /> Start verification
          </Link>
          <Link href="/tools/grounding" className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--landing-primary-20)] bg-white/60 px-6 text-sm font-bold text-[var(--landing-primary)] transition-transform active:scale-[0.97]">Use grounding tools</Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Crisis and public support resources remain available without verification.</p>
      </div>
    );
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || vm.isSending || !vm.activeConversationId) return;
    setDraft("");
    await vm.sendMessage(vm.activeConversationId, content);
  }

  return (
    <div className="space-y-6">
      <EchoMotionSurface as="div" tilt={false} className="relative mb-6 overflow-hidden rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(120deg,rgba(251,247,238,0.96),rgba(220,232,214,0.74))] p-6 shadow-[0_18px_50px_rgba(30,53,34,0.08)] sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/60 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-[var(--landing-primary)]">Reflective Buddy</p>
            <h1 className="mt-3 text-[clamp(2.8rem,5vw,5rem)] font-medium leading-[0.9] tracking-[-0.06em] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">Talk it through gently.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--landing-muted)] sm:text-[15px]">A private place to name what feels present, find steadier ground, and choose one small next step.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/buddy/history" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--landing-primary-20)] bg-[var(--landing-cream-70)] px-5 text-sm font-bold text-[var(--landing-primary)] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97]">
              <History className="h-4 w-4" aria-hidden="true" />
              Reflection history
            </Link>
          </div>
        </div>
      </EchoMotionSurface>

      <div className="echo-card-motion-grid grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <EchoMotionSurface
          tilt={false}
          className="overflow-hidden rounded-[2rem] border border-[var(--landing-primary-10)] bg-[rgba(255,253,247,0.88)] shadow-[0_20px_54px_rgba(30,53,34,0.08)] backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-4 bg-[radial-gradient(circle_at_0%_0%,rgba(169,208,162,0.24),transparent_16rem),var(--landing-footer)] px-5 py-4 text-[var(--landing-inverse)] sm:px-7">
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

            <div className="relative p-4 sm:p-7">
              <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-2/3 -translate-x-1/2 rounded-full bg-[var(--landing-sage-soft)]/35 blur-3xl" aria-hidden="true" />
            <div className="relative min-h-[390px] space-y-5 rounded-[1.5rem] border border-[var(--landing-primary-10)] bg-white/35 p-3 sm:p-5" aria-live="polite" aria-busy={vm.isLoadingMessages || vm.isSending}>
              {vm.isLoadingMessages && vm.messages.length === 0 ? (
                <p className="py-16 text-center text-sm text-[var(--landing-muted)]">Opening your private conversation…</p>
              ) : null}
              {!vm.isLoadingMessages && vm.messages.length === 0 ? (
                <div className="grid min-h-[18rem] place-items-center text-center">
                  <div>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--landing-sage-soft)] text-[var(--landing-primary)]">
                      <Bot className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <p className="mt-4 font-[family-name:var(--font-echo-display)] text-2xl text-[var(--landing-ink)]">Start with one sentence.</p>
                    <p className="mt-2 text-sm text-[var(--landing-muted)]">Buddy will keep the next step gentle and practical.</p>
                  </div>
                </div>
              ) : null}
              {vm.messages.map((message) => (
                <BuddyChatBubble key={message.id} message={message} />
              ))}
              {vm.isSending ? (
                <p className="pl-14 text-xs font-medium text-[var(--landing-muted)]">Buddy is reflecting…</p>
              ) : null}
              <div ref={conversationEndRef} />
            </div>

            <div className="relative mt-5 rounded-[1.35rem] border border-[var(--landing-primary-10)] bg-[var(--landing-cream-70)] p-3">
              <p className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--landing-primary)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Gentle ways to begin
              </p>
              <div className="flex flex-wrap gap-2">
                {promptChips.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setDraft(prompt)} className="rounded-full border border-[var(--landing-primary-15)] bg-[var(--landing-cream-70)] px-4 py-2 text-xs font-semibold text-[var(--landing-muted)] outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--landing-sage-soft)] hover:text-[var(--landing-primary)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97]">
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="sticky bottom-3 mt-4 rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-white/82 p-3 shadow-[0_12px_30px_rgba(30,53,34,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur focus-within:border-[var(--landing-primary-40)] focus-within:ring-4 focus-within:ring-[var(--landing-primary-10)]">
              {voice.interimTranscript ? (
                <p className="mb-2 rounded-full bg-[var(--landing-sage-soft)]/70 px-3 py-1.5 text-xs font-medium text-[var(--landing-primary)]">
                  Listening: {voice.interimTranscript}
                </p>
              ) : null}
              <div className="flex items-end gap-2">
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
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                className="min-h-12 flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-6 text-[var(--landing-ink)] outline-none placeholder:text-[var(--landing-muted)]"
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
              <button type="button" onClick={() => void handleSend()} disabled={!draft.trim() || vm.isSending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] outline-none transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] hover:shadow-[0_8px_18px_rgba(30,53,34,0.18)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45" aria-label="Send message">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
              </div>
            </div>
            {voice.voiceError ? <p role="status" className="mt-2 text-xs font-medium text-[var(--landing-muted)]">{voice.voiceError}</p> : null}
            {vm.error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{vm.error}</p> : null}
          </div>
        </EchoMotionSurface>

        <aside className="space-y-5">
          <EchoMotionSurface className="rounded-[2rem] border border-[var(--landing-primary-10)] bg-[rgba(255,253,247,0.88)] p-6 shadow-[0_18px_44px_rgba(30,53,34,0.07)]">
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

          <EchoMotionSurface tilt={false} className="rounded-[2rem] border border-white/10 bg-[var(--landing-footer)] p-6 text-[var(--landing-inverse)] shadow-[0_18px_44px_rgba(16,39,24,0.16)]">
            <LockKeyhole className="h-5 w-5 text-[#a9d0a2]" aria-hidden="true" />
            <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/55">Private by design</p>
            <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] [font-family:var(--font-echo-display)]">Your conversation stays yours.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--landing-inverse-80)]">ECHO is a reflective support tool, not a diagnostic service.</p>
          </EchoMotionSurface>
        </aside>
      </div>
    </div>
  );
}
