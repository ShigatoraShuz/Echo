import Link from "next/link";
import { History, Send, ShieldAlert, Wind } from "lucide-react";
import { ChatBubble, CrisisHelpCard, EchoCard, MoodBadge, PageHeader, PrivacyNotice } from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { buddyMessages, promptChips } from "@/lib/mock-data";

export default function BuddyPage() {
  return (
    <AppShell>
      <PageHeader
        label="Buddy"
        title="Talk with Buddy"
        description="A reflective chat interface for grounding and next steps. Buddy is not a diagnostic tool."
        action={
          <Link href="/buddy/history" className="echo-button-secondary">
            <History className="h-4 w-4" aria-hidden="true" />
            History
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <EchoCard title="Conversation" description="Sample messages for the future Buddy backend.">
          <div className="space-y-5">
            <div className="space-y-4">
              {buddyMessages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {promptChips.map((prompt) => (
                <button key={prompt} type="button" className="rounded-full border border-border/70 bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3 rounded-2xl border border-border/70 bg-background p-3">
              <textarea className="min-h-12 flex-1 resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground" placeholder="Tell Buddy what feels present..." />
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-label="Send message">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </EchoCard>

        <aside className="space-y-5">
          <EchoCard title="Current mood" description="User-selected context for Buddy prompts.">
            <MoodBadge mood="anxious" />
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Buddy should respond with steadiness and avoid clinical claims.</p>
          </EchoCard>

          <EchoCard title="Helpful tools" description="Quick support options.">
            <div className="grid gap-3">
              <Link href="/tools/grounding" className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-4 hover:bg-muted">
                <Wind className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Start grounding</span>
              </Link>
              <Link href="/crisis" className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-crisis-soft p-4">
                <ShieldAlert className="h-5 w-5 text-danger" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Crisis support</span>
              </Link>
            </div>
          </EchoCard>

          <PrivacyNotice />
          <CrisisHelpCard compact />
        </aside>
      </div>
    </AppShell>
  );
}
