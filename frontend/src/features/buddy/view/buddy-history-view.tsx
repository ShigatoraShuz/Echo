"use client";
import { useState, useMemo } from "react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { BuddyConversationList } from "../components/buddy-conversation-list";
import { BuddyMessageContainer } from "../components/buddy-message-container";
import { BuddySearchFilter } from "../components/buddy-search-filter";
import { BuddyErrorState } from "../components/buddy-error-state";
import { BuddyEmptyState } from "../components/buddy-empty-state";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { EchoPageHeading } from "@/shared/components/data-display/echo-page-heading";
import { Bot } from "lucide-react";
import Link from "next/link";

export function BuddyHistoryView() {
  const vm = useBuddyViewModel();
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);

  const filteredConversations = useMemo(() => {
    if (!filteredIds) return vm.conversations;
    return vm.conversations.filter((c) => filteredIds.includes(c.id));
  }, [vm.conversations, filteredIds]);

  if (vm.error && vm.conversations.length === 0) {
    return <BuddyErrorState message={vm.error} onRetry={() => vm.loadConversations()} />;
  }

  return (
    <div className="space-y-6">
      <EchoPageHeading
        title="Chat history"
        description="Review past Buddy conversations as private reflective records. They are not diagnostic assessments."
        badge="Buddy"
        action={<Link href="/buddy" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90"><Bot className="h-4 w-4" /> Open Buddy</Link>}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <BuddySearchFilter conversations={vm.conversations} onFilteredResults={(ids) => setFilteredIds(ids)} />
          <BuddyConversationList
            conversations={filteredConversations}
            isLoading={vm.isLoadingList}
            selectedId={vm.activeConversationId ?? undefined}
            onSelect={(id) => vm.selectConversation(id)}
          />
        </div>

        <div>
          {!vm.activeConversationId ? (
            <BuddyEmptyState />
          ) : (
            <div className="rounded-[2rem] border border-border bg-card p-5 shadow-subtle sm:p-7">
              <BuddyMessageContainer
                messages={vm.messages}
                isStreaming={vm.isStreaming}
                streamingContent={vm.streamingContent}
                onRetry={() => vm.activeConversationId && vm.retryMessage(vm.activeConversationId)}
                onCopy={(id, content) => navigator.clipboard.writeText(content)}
                onFeedback={(id, fb) => vm.sendFeedback(id, fb)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
