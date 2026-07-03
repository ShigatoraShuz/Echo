import Link from "next/link";
import { Bot, Save, Tag } from "lucide-react";
import { EchoCard, PageHeader, PrivacyNotice } from "@/components/echo/shared";
import { MoodSelector } from "@/components/echo/mood-selector";
import { AppShell } from "@/components/echo/shells";

export default function NewJournalEntryPage() {
  return (
    <AppShell>
      <PageHeader
        label="Journal"
        title="New reflection"
        description="Write freely. Mood and distress summaries are signals only, not diagnosis."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <EchoCard title="Entry editor" description="A backend-ready composition surface for a private journal entry.">
          <form className="space-y-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Title</span>
              <input className="echo-input" placeholder="What would you call this moment?" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Reflection</span>
              <textarea className="echo-textarea min-h-64" placeholder="Write a few honest sentences. You do not need to make it polished." />
            </label>
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Mood</p>
              <MoodSelector initialMood="calm" />
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Tags</span>
              <span className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                <input className="echo-input pl-10" placeholder="sleep, walk, work" />
              </span>
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="echo-button-primary">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save reflection
              </button>
              <Link href="/journal" className="echo-button-secondary">Back to journal</Link>
            </div>
          </form>
        </EchoCard>

        <aside className="space-y-5">
          <EchoCard title="Voice of support" description="A steady prompt for the current entry.">
            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Try: What part of today felt heavy, and what helped even a little?
              </p>
            </div>
          </EchoCard>
          <PrivacyNotice />
        </aside>
      </div>
    </AppShell>
  );
}
