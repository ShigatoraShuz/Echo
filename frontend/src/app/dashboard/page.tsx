import Link from "next/link";
import { Bell, CalendarClock, Flame, Lock, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import {
  CrisisHelpCard,
  DataChartCard,
  EchoCard,
  JournalEntryCard,
  PageHeader,
  RiskScoreRing,
} from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { journalEntries, moodTrend, quickActions, riskTrend, userProfile, weeklyDigest } from "@/lib/mock-data";

export default function DashboardPage() {
  const latestEntry = journalEntries[0];

  return (
    <AppShell>
      <PageHeader
        label="Dashboard"
        title={`Good evening, ${userProfile.name}`}
        description="A private overview of your recent reflections, patterns, and support options. ECHO is not a diagnostic tool."
        action={
          <div className="flex gap-2">
            <button type="button" className="echo-button-secondary h-11 px-4" aria-label="Notifications">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link href="/journal/new" className="echo-button-primary">
              <PenLine className="h-4 w-4" aria-hidden="true" />
              New entry
            </Link>
          </div>
        }
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <div className="grid min-w-0 gap-5 md:grid-cols-3">
            <EchoCard compact>
              <Flame className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-4 text-3xl font-semibold text-foreground">{userProfile.streakDays}</p>
              <p className="mt-1 text-sm text-muted-foreground">day journaling streak</p>
            </EchoCard>
            <EchoCard compact>
              <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold text-foreground">{userProfile.nextCheckIn}</p>
              <p className="mt-1 text-sm text-muted-foreground">upcoming check-in</p>
            </EchoCard>
            <EchoCard compact>
              <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold text-foreground">{userProfile.privacyStatus}</p>
              <p className="mt-1 text-sm text-muted-foreground">privacy status</p>
            </EchoCard>
          </div>

          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <DataChartCard title="Mood trends" description="Theme-token chart of this week's reflective mood signals." points={moodTrend} />
            <EchoCard title="Current distress signal" description="This score is a support signal, not a diagnosis.">
              <RiskScoreRing score={latestEntry.riskScore} band={latestEntry.riskBand} />
            </EchoCard>
          </div>

          <EchoCard title="Recent journal entries" description="Private reflections with mood tags and non-diagnostic risk bands.">
            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
              {journalEntries.map((entry) => (
                <JournalEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </EchoCard>
        </div>

        <aside className="min-w-0 space-y-5">
          <EchoCard title="Weekly digest" description="Pattern notes from sample data.">
            <div className="space-y-3">
              {weeklyDigest.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-border/70 bg-background p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </EchoCard>

          <EchoCard title="Quick actions" description="Common ways to check in.">
            <div className="grid gap-3">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href} className="rounded-2xl border border-border/70 bg-background p-4 hover:bg-muted">
                  <p className="text-sm font-semibold text-foreground">{action.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
                </Link>
              ))}
            </div>
          </EchoCard>

          <EchoCard title="Risk history" description="Rolling signals are informational, never diagnostic." compact>
            <div className="space-y-3">
              {riskTrend.slice(-4).map((point) => (
                <div key={point.label} className="flex items-center gap-3">
                  <span className="w-10 text-xs font-medium text-muted-foreground">{point.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${point.value}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold text-foreground">{point.value}</span>
                </div>
              ))}
            </div>
          </EchoCard>

          <EchoCard compact>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-muted-foreground">
                Your visible scores are reflective summaries only. ECHO is not a diagnostic tool.
              </p>
            </div>
          </EchoCard>

          <CrisisHelpCard compact />
        </aside>
      </div>
    </AppShell>
  );
}
