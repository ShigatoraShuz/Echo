"use client";
import Link from "next/link";
import { BadgeCheck, Bot, LockKeyhole } from "lucide-react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { BuddyChatBubble } from "../components/buddy-chat-bubble";
import { EchoCard, PageHeader } from "@/shared/components/layout";

export function BuddyHistoryView() {
  const vm = useBuddyViewModel();

  if (vm.accessStatus === "loading") {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-card/70" />;
  }

  if (vm.accessStatus === "blocked") {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-8 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <h1 className="mt-5 font-serif text-3xl">Verification is required</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Buddy conversation history becomes available after an administrator approves your identity and age verification.</p>
        <Link href="/settings/verification" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
          <BadgeCheck className="h-4 w-4" /> Open verification
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        label="Buddy"
        title="Chat history"
        description="Review past Buddy conversations as private reflective records. They are not diagnostic assessments."
        action={<Link href="/buddy" className="echo-button-primary"><Bot className="h-4 w-4" aria-hidden="true" />Open Buddy</Link>}
      />

      <div className="space-y-5">
          <EchoCard title="Sessions" description="Conversation summaries and message counts.">
            <div className="grid gap-3">
              {vm.conversations.map((conversation) => (
                <div key={conversation.id} className="rounded-2xl border border-border/70 bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{conversation.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{conversation.lastMessageAt} · {conversation.messageCount} messages · {conversation.mood}</p>
                    </div>
                    <Link href="/buddy" className="text-sm font-semibold text-primary">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          </EchoCard>

          <EchoCard title="Latest preview" description="Recent messages from the current sample conversation.">
            <div className="space-y-4">
              {vm.messages.map((message) => (
                <BuddyChatBubble key={message.id} message={message} />
              ))}
            </div>
          </EchoCard>
      </div>
    </div>
  );
}
