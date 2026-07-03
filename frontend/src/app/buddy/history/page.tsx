import Link from "next/link";
import { Bot, Search } from "lucide-react";
import { ChatBubble, EchoCard, PageHeader } from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { buddyMessages } from "@/lib/mock-data";

const sessions = [
  { title: "Evening grounding", date: "Today", mood: "anxious", count: 8 },
  { title: "After-work reflection", date: "Yesterday", mood: "neutral", count: 12 },
  { title: "Sleep routine planning", date: "Monday", mood: "calm", count: 6 },
];

export default function BuddyHistoryPage() {
  return (
    <AppShell>
      <PageHeader
        label="Buddy"
        title="Chat history"
        description="Review past Buddy conversations as private reflective records. They are not diagnostic assessments."
        action={<Link href="/buddy" className="echo-button-primary"><Bot className="h-4 w-4" aria-hidden="true" />Open Buddy</Link>}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <EchoCard title="Filters" description="Static filter controls for future search.">
          <div className="space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
              <input className="echo-input pl-10" placeholder="Search conversations" />
            </label>
            <select className="echo-input">
              <option>All moods</option>
              <option>Calm</option>
              <option>Anxious</option>
            </select>
            <select className="echo-input">
              <option>Newest first</option>
              <option>Most messages</option>
            </select>
          </div>
        </EchoCard>

        <div className="space-y-5">
          <EchoCard title="Sessions" description="Conversation summaries and message counts.">
            <div className="grid gap-3">
              {sessions.map((session) => (
                <div key={session.title} className="rounded-2xl border border-border/70 bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{session.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{session.date} · {session.count} messages · {session.mood}</p>
                    </div>
                    <Link href="/buddy" className="text-sm font-semibold text-primary">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          </EchoCard>

          <EchoCard title="Latest preview" description="Recent messages from the current sample conversation.">
            <div className="space-y-4">
              {buddyMessages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
            </div>
          </EchoCard>
        </div>
      </div>
    </AppShell>
  );
}
