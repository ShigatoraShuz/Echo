"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  ChevronRight,
  Leaf,
  LockKeyhole,
  PenLine,
  Sparkles,
} from "lucide-react";
import reflectionLandscape from "../../../../assets/journal-writing.webp";
import { ErrorState, LoadingState } from "@/shared/components/feedback";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { ReflectionActivityGraph } from "@/shared/components/ui/reflection-activity-graph";
import { useDashboardViewModel } from "../view-model/use-dashboard-view-model";
import { dashboardPreviewService } from "../model/dashboard-preview.service";
import { JournalCbtRecommendation } from "@/features/journal/components/journal-cbt-recommendation";
import { AnalysisInsightsDashboard } from "../components/analysis-insights-dashboard";
import { DominantEmotionWheel } from "../components/dominant-emotion-wheel";
import { WellnessCheckin } from "../components/wellness-checkin";
import { analysisSummary } from "@/features/journal/model/analysis-summary";
import { OverallAnalysis } from "../components/overall-analysis";

function DashboardCard({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <EchoMotionSurface
      data-testid={testId}
      className={`echo-dashboard-card min-w-0 rounded-[1.75rem] border border-[var(--landing-primary-10)] bg-[rgba(255,253,247,0.84)] p-4 shadow-[0_16px_42px_rgba(30,53,34,0.07)] backdrop-blur-sm sm:p-5 xl:p-4 ${className}`}
    >
      {children}
    </EchoMotionSurface>
  );
}

function buildWellbeingActivity(entries: Array<{ createdAt: string }>) {
  const activity = new Map<string, number>();

  for (const entry of entries) {
    const date = entry.createdAt.slice(0, 10);

    activity.set(date, (activity.get(date) ?? 0) + 1);
  }

  return Array.from(activity, ([date, count]) => ({
    date,
    count,
  }));
}

export function DashboardView({ preview = false }: { preview?: boolean }) {
  const { data, isLoading, error, retry } = useDashboardViewModel(
    "7d",
    preview && process.env.NODE_ENV !== "production" ? dashboardPreviewService : undefined,
  );

  const [activityWeeks, setActivityWeeks] = useState(26);

  if (isLoading && !data) {
    return (
      <div aria-busy="true" className="echo-dashboard-welcome dashboard-premium space-y-4">
        <header className="echo-dashboard-hero rounded-3xl bg-[linear-gradient(120deg,rgba(251,247,238,0.94),rgba(220,232,214,0.72))] px-5 py-4 sm:px-6">
          <p className="dashboard-eyebrow mb-3">YOUR QUIET CORNER</p>
          <h1 className="font-serif text-3xl text-foreground">Dashboard</h1>
        </header>
        <LoadingState label="Loading your ECHO space..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-3">
        <ErrorState title="Could not load dashboard" description={error ?? "No data available."} />
        <button type="button" onClick={() => void retry()} className="echo-button-secondary">
          Retry dashboard
        </button>
      </div>
    );
  }

  const { userProfile, journalEntries } = data;

  const latestAnalysis = data.analysisInsights?.latest;
  const latestSummary = analysisSummary(latestAnalysis);
  const weekStart = Date.now() - 7 * 86_400_000;
  const thisWeek = journalEntries.filter(
    (entry) => Date.parse(entry.createdAt) >= weekStart && Date.parse(entry.createdAt) <= Date.now(),
  );
  const reflectionDays = new Set(thisWeek.map((entry) => entry.createdAt.slice(0, 10))).size;
  const recentModel =
    data.analysisInsights?.latestAnalyzedAt && Date.parse(data.analysisInsights.latestAnalyzedAt) >= weekStart;
  const weeklyDigest = thisWeek.length
    ? [
        `You saved ${thisWeek.length} reflection${thisWeek.length === 1 ? "" : "s"} in the past 7 days.`,
        `You made space to reflect on ${reflectionDays} day${reflectionDays === 1 ? "" : "s"} this week.`,
        recentModel && latestSummary.emotion
          ? `${latestSummary.emotion} was the strongest signal in your latest saved analysis.`
          : "No completed model analysis from this week yet.",
      ]
    : [
        "No reflections saved in the past 7 days.",
        "A few words are enough to begin again.",
        "Your older reflections are still here to revisit.",
      ];
  const recentEntries = journalEntries.slice(0, 3);

  const wellbeingActivity = buildWellbeingActivity(journalEntries);

  return (
    <div aria-busy={isLoading} className="echo-dashboard-welcome dashboard-premium space-y-4">
      {isLoading && <p role="status" className="sr-only">Updating your dashboard…</p>}

      <div className="dashboard-top-grid grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <header className="echo-dashboard-hero flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-3xl bg-[linear-gradient(120deg,rgba(251,247,238,0.94),rgba(220,232,214,0.72))] px-5 py-4 sm:px-6 lg:col-span-2 xl:col-span-6">
          <div className="min-w-0">
            <p className="dashboard-eyebrow mb-3">YOUR QUIET CORNER</p>
            <h1 className="break-words text-[clamp(1.75rem,2.5vw,2.5rem)] font-medium leading-tight tracking-[-0.035em] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              {[
                `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},`,
                ...userProfile.name.split(" "),
              ].map((word, index) => (
                <span key={index} className="dashboard-word-mask">
                  <span style={{ animationDelay: `${200 + index * 105}ms` }}>{word}</span>
                </span>
              ))}
            </h1>

            <p className="mt-1 text-xs text-[var(--landing-muted)]">
              {journalEntries.length} total reflection{journalEntries.length === 1 ? "" : "s"}{" "}
              <span aria-hidden="true">·</span> {userProfile.streakDays}-day gentle streak
            </p>
          </div>

          <Link
            href="/journal/new"
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--landing-primary)] px-4 text-sm font-semibold text-[var(--landing-inverse)] outline-none transition-colors hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-ring/20 dashboard-cta`}
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Write reflection
          </Link>
        </header>

        <AnalysisInsightsDashboard insights={data.analysisInsights} />
        <OverallAnalysis entries={journalEntries} insights={data.analysisInsights} />
      </div>

      {!preview && data.analysisInsights?.latest?.schemaVersion === "echo-journal-analysis-v3" &&
      !data.analysisInsights.latest.isSimulated &&
      (data.analysisInsights.latest.cbtRecommendation || data.analysisInsights.latest.supportReviewRequired) ? (
        <JournalCbtRecommendation result={data.analysisInsights.latest} heading="Latest reflection recommendation" />
      ) : null}

      {/* DASHBOARD GRID */}
      <div className="echo-card-motion-grid dashboard-main-grid grid gap-4 lg:grid-cols-12">
        {/* EMOTION WHEEL */}
        <DashboardCard className="bg-[linear-gradient(145deg,rgba(255,253,247,0.92),rgba(230,239,224,0.82))] dashboard-emotion-card lg:col-span-5">
          <DominantEmotionWheel entries={journalEntries} insights={data.analysisInsights ?? null} />
        </DashboardCard>

        {/* USER-COMPLETED PHQ-8 CHECK-IN */}
        <DashboardCard className="dashboard-signal-card echo-immediate-card bg-[linear-gradient(155deg,rgba(255,253,247,0.94),rgba(237,242,240,0.88))] lg:col-span-3">
          <WellnessCheckin preview={preview} showGauge />
        </DashboardCard>

        {/* REFLECTION SPACE */}
        <DashboardCard className="dashboard-reflection-card relative min-h-[250px] overflow-hidden lg:col-span-4 xl:min-h-[220px]">
          <div className="relative z-10 max-w-[60%] sm:max-w-[56%]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Reflection space</p>

            <h2 className="mt-2 text-3xl font-medium leading-[0.98] tracking-[-0.05em] [font-family:var(--font-echo-display)] sm:text-4xl xl:text-3xl">
              Write what is present today
            </h2>

            <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
              Journaling can make room for the thoughts, feelings, and small details you want to hold.
            </p>

            <Link
              href="/journal/new"
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--landing-primary)] px-4 text-xs font-bold text-[var(--landing-inverse)] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]"
            >
              New entry
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <Image
            src={reflectionLandscape}
            alt="An open journal and green fountain pen in warm sunlight"
            priority
            sizes="(min-width: 1280px) 260px, (min-width: 1024px) 34vw, 50vw"
            className="dashboard-landscape absolute bottom-0 right-0 h-full w-[46%] object-cover object-[62%_center] opacity-95 [mask-image:linear-gradient(to_left,black_66%,transparent)]"
          />
        </DashboardCard>

        {/* RECENT REFLECTIONS */}
        <DashboardCard className="dashboard-recent-card lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Recent reflections</p>

              <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">Keep close</h2>
            </div>

            <Link href="/journal" className="text-xs font-semibold text-primary">
              See all
            </Link>
          </div>

          {recentEntries.length === 0 && (
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Your next reflection starts a story worth keeping.{" "}
              <Link href="/journal/new" className="font-semibold text-primary underline">
                Write your first entry
              </Link>
            </p>
          )}
          <div className="mt-2 divide-y divide-border/65">
            {recentEntries.map((entry) => (
              <Link
                key={entry.id}
                href={`/journal/${entry.id}`}
                className="flex items-center gap-3 py-2 outline-none transition-colors hover:text-primary focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold text-foreground">{entry.title}</strong>

                  <span className="block truncate pt-0.5 text-[10px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </DashboardCard>

        {/* WEEKLY DIGEST */}
        <DashboardCard className="dashboard-digest-card lg:col-span-4 xl:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Weekly digest</p>

          <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">This week&apos;s patterns</h2>

          <ul className="mt-3 space-y-2">
            {weeklyDigest.slice(0, 3).map((item) => (
              <li key={item} className="flex gap-2.5 text-xs leading-5 text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />

                {item}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary/70 p-2.5">
            <Leaf className="h-4 w-4 text-primary" aria-hidden="true" />

            <p className="text-xs text-secondary-foreground">Small steps count. Let today be enough.</p>
          </div>
        </DashboardCard>

        {/* WELLBEING ACTIVITY */}
        <DashboardCard
          className="dashboard-activity-card overflow-hidden lg:col-span-8 xl:col-span-4"
          testId="wellbeing-activity-card"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Wellbeing activity</p>

              <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">Your reflection rhythm</h2>
            </div>

            <label className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 text-xs font-semibold text-foreground shadow-subtle">
              <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />

              <span className="sr-only">Activity range</span>

              <select
                value={activityWeeks}
                onChange={(event) => setActivityWeeks(Number(event.target.value))}
                className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
                aria-label="Choose wellbeing activity range"
              >
                <option value={4}>Last 30 days</option>
                <option value={13}>Last 3 months</option>
                <option value={26}>Last 6 months</option>
                <option value={52}>Last 1 year</option>
              </select>

              <ChevronRight
                className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 rotate-90 text-muted-foreground"
                aria-hidden="true"
              />
            </label>
          </div>

          <ReflectionActivityGraph
            data={wellbeingActivity}
            weeks={activityWeeks}
            cellSize={11}
            cellGap={2}
            ariaLabel="Wellbeing activity by day, Monday through Sunday"
            singularLabel="wellbeing activity"
            pluralLabel="wellbeing activities"
            className="mt-2"
          />

          <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/60 pt-2 text-xs text-muted-foreground">
            <span>Your rhythm remains private. Select a day for details.</span>

            <Link
              href="/journal"
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary outline-none hover:text-primary/80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Open journal
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </DashboardCard>

        {/* PRIVACY */}
        <DashboardCard className="dashboard-privacy-card overflow-hidden border-white/10 bg-[var(--landing-footer)] text-[var(--landing-inverse)] lg:col-span-4 xl:col-span-2">
          <LockKeyhole className="h-5 w-5 text-primary-foreground/80" aria-hidden="true" />

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/65">
            Private by design
          </p>

          <h2 className="mt-1 text-xl font-semibold tracking-[-0.045em]">Your words stay yours.</h2>

          <p className="mt-2 text-xs leading-5 text-primary-foreground/72">
            Your reflections are a personal space. Review your privacy choices whenever you need.
          </p>

          <Link
            href="/settings/privacy"
            className="mt-3 inline-flex h-9 items-center rounded-xl bg-card px-3 text-xs font-semibold text-primary outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-card/90 focus-visible:ring-4 focus-visible:ring-white/25 active:scale-[0.97]"
          >
            Review privacy
          </Link>
        </DashboardCard>
      </div>

      <footer className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-1 text-[11px] leading-5 text-muted-foreground">
        <p className="flex items-center gap-2">
        <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Your private reflections are for support, not diagnosis.
        </p>
        <p className="max-w-md sm:ml-auto sm:text-right">
          ECHO&apos;s AI tools support reflection and do not replace a qualified therapist or mental health professional.
        </p>
      </footer>
    </div>
  );
}
