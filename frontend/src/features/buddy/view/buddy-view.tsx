"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BadgeCheck, Bot, HeartHandshake, History, Leaf, LockKeyhole, Send, ShieldAlert, Sparkles, Wind } from "lucide-react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { BuddyChatBubble } from "../components/buddy-chat-bubble";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { moodStyles } from "@/shared/theme";

const promptChips = [
  "Help me untangle a thought",
  "Guide a two-minute grounding",
  "Reflect on today",
  "Plan a gentle next step",
];

export function BuddyView() {
  const vm = useBuddyViewModel();
  const [draft, setDraft] = useState("");
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [vm.messages]);

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
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--landing-muted)]">Buddy and AI-supported features are available after an administrator approves your account verification. Users under 18 also need a parent or legal guardian.</p>
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
          <div className="flex items-center justify-between gap-4 bg-[var(--landing-footer)] px-5 py-4 text-[var(--landing-inverse)] sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold tracking-[-0.025em]">Your quiet conversation</h2>
                <p className="mt-0.5 text-xs text-[var(--landing-inverse-80)]">Buddy is here to listen, not diagnose.</p>
              </div>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9dcc9f]" />
              Private session
            </span>
          </div>

          <div className="relative p-5 sm:p-7">
            <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-2/3 -translate-x-1/2 rounded-full bg-[var(--landing-sage-soft)]/35 blur-3xl" aria-hidden="true" />
            <div className="relative min-h-[390px] space-y-5" aria-live="polite" aria-busy={vm.isLoadingMessages || vm.isSending}>
              {vm.isLoadingMessages && vm.messages.length === 0 ? (
                <p className="py-16 text-center text-sm text-[var(--landing-muted)]">Opening your private conversation…</p>
              ) : null}
              {vm.messages.map((message) => (
                <BuddyChatBubble key={message.id} message={message} />
              ))}
              {vm.isSending ? (
                <p className="pl-14 text-xs font-medium text-[var(--landing-muted)]">Buddy is reflecting…</p>
              ) : null}
              <div ref={conversationEndRef} />
            </div>

            <div className="relative mt-6 border-t border-[var(--landing-primary-10)] pt-5">
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

            <div className="mt-4 flex items-end gap-3 rounded-[1.4rem] border border-[var(--landing-primary-15)] bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus-within:border-[var(--landing-primary-40)] focus-within:ring-4 focus-within:ring-[var(--landing-primary-10)]">
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
              <button type="button" onClick={() => void handleSend()} disabled={!draft.trim() || vm.isSending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] outline-none transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] hover:shadow-[0_8px_18px_rgba(30,53,34,0.18)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45" aria-label="Send message">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {vm.error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{vm.error}</p> : null}
          </div>
        </EchoMotionSurface>

        <aside className="space-y-5">
          <EchoMotionSurface className="overflow-hidden rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(145deg,rgba(255,253,247,0.94),rgba(226,237,220,0.86))] p-6 shadow-[0_18px_44px_rgba(30,53,34,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[var(--landing-primary)]">How you are arriving</p>
              <Leaf className="h-4 w-4 text-[var(--landing-primary)]" aria-hidden="true" />
            </div>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.045em] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">Current mood</h2>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/60 p-4">
              <span className={moodStyles.anxious}>anxious</span>
              <span className="text-xs text-[var(--landing-muted)]">You can change this</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--landing-muted)]">Buddy will respond with steadiness and keep the next step practical.</p>
          </EchoMotionSurface>

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