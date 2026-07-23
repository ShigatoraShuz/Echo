"use client";
import { useState } from "react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { BuddyConversationList } from "../components/buddy-conversation-list";
import { BuddyMessageContainer } from "../components/buddy-message-container";
import { BuddyInput } from "../components/buddy-input";
import { BuddyEmptyState } from "../components/buddy-empty-state";
import { BuddyErrorState } from "../components/buddy-error-state";
import { BuddyNewConversationDialog } from "../components/buddy-new-conversation-dialog";
import { BuddySearchFilter } from "../components/buddy-search-filter";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { Bot, History, Plus } from "lucide-react";
import Link from "next/link";

export function BuddyView() {
  const vm = useBuddyViewModel();
  const [showNewDialog, setShowNewDialog] = useState(false);

  async function handleCreate(title: string) {
    const id = await vm.createConversation(title);
    if (id) { setShowNewDialog(false); await vm.selectConversation(id); }
  }

  function handlePromptSelect(prompt: string) {
    if (vm.activeConversationId) vm.sendMessage(vm.activeConversationId, prompt);
  }

  if (vm.isLoadingList) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-[2rem] bg-secondary/50" />
        <div className="h-96 animate-pulse rounded-[2rem] bg-secondary/30" />
      </div>
    );
  }

  if (vm.error && vm.conversations.length === 0) {
    return <BuddyErrorState message={vm.error} onRetry={() => vm.loadConversations()} />;
  }

  return (
    <div className="space-y-6">
      <EchoMotionSurface as="div" tilt={false} className="overflow-hidden rounded-[2rem] border border-primary/10 bg-gradient-to-br from-card to-secondary/30 p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-primary">Reflective Buddy</p>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.5rem)] font-medium leading-[0.9] tracking-[-0.06em] text-foreground font-serif">Talk it through gently.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">A private place to name what feels present, find steadier ground, and choose one small next step.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setShowNewDialog(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New conversation
            </button>
            <Link href="/buddy/history" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-bold text-foreground hover:bg-secondary/60">
              <History className="h-4 w-4" /> History
            </Link>
          </div>
        </div>
      </EchoMotionSurface>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <EchoMotionSurface tilt={false} className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-subtle">
          <div className="border-b border-border p-4">
            <BuddySearchFilter conversations={vm.conversations} onFilteredResults={() => {}} />
          </div>
          <BuddyConversationList
            conversations={vm.conversations}
            isLoading={false}
            selectedId={vm.activeConversationId ?? undefined}
            onSelect={(id) => vm.selectConversation(id)}
          />
        </EchoMotionSurface>

        <EchoMotionSurface tilt={false} className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-subtle">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-subtle">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold tracking-[-0.025em] text-foreground">Your quiet conversation</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Buddy is here to listen, not diagnose.</p>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-7">
            {!vm.activeConversationId ? (
              <BuddyEmptyState onPromptSelect={(p) => { if (vm.conversations.length > 0) { vm.selectConversation(vm.conversations[0].id); setTimeout(() => vm.sendMessage(vm.conversations[0].id, p), 100); }}} />
            ) : (
              <>
                <BuddyMessageContainer
                  messages={vm.messages}
                  isStreaming={vm.isStreaming}
                  streamingContent={vm.streamingContent}
                  onRetry={() => vm.retryMessage(vm.activeConversationId!)}
                  onCopy={(id, content) => navigator.clipboard.writeText(content)}
                  onFeedback={(id, fb) => vm.sendFeedback(id, fb)}
                />
                <div className="mt-4">
                  <BuddyInput
                    onSend={(content) => vm.sendMessage(vm.activeConversationId!, content)}
                    isSending={vm.isSending}
                  />
                </div>
              </>
            )}
          </div>
        </EchoMotionSurface>
      </div>

      <BuddyNewConversationDialog
        isOpen={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreate={handleCreate}
        isCreating={false}
      />
    </div>
  );
}
