"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  Check,
  ChevronRight,
  HeartPulse,
  Leaf,
  LockKeyhole,
  PenLine,
  Sparkles,
} from "lucide-react";
import reflectionLandscape from "../../../../assets/growth-doorway-hill.png";
import { ErrorState, LoadingState } from "@/shared/components/feedback";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { ReflectionActivityGraph } from "@/shared/components/ui/reflection-activity-graph";
import { settingsService } from "@/services/settings/settings.service";
import { assessmentService } from "@/services/assessment/assessment.service";
import { MoodCheckIn, type QuickMood } from "../components/mood-checkin";
import { Phq8CheckIn } from "../components/phq8-check-in";
import { useDashboardViewModel } from "../view-model/use-dashboard-view-model";

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
      className={`echo-dashboard-card min-w-0 rounded-[1.75rem] border border-[var(--landing-primary-10)] bg-[rgba(255,253,247,0.84)] p-5 shadow-[0_16px_42px_rgba(30,53,34,0.07)] backdrop-blur-sm sm:p-6 ${className}`}
    >
      {children}
    </EchoMotionSurface>
  );
}

function StatusPill({
  children,
  tone = "calm",
}: {
  children: ReactNode;
  tone?: "calm" | "warm" | "sage";
}) {
  const styles = {
    calm: "bg-[hsl(var(--calm)/0.23)] text-primary",
    warm: "bg-[hsl(var(--anxious)/0.18)] text-[hsl(var(--risk-high-foreground))]",
    sage: "bg-secondary text-secondary-foreground",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/*
 * Header metric
 * Flame/icon container removed.
 */
function TinyMetric({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-w-[138px] items-center rounded-full border border-[var(--landing-primary-10)] bg-[var(--landing-cream-95)] px-4 py-2.5 shadow-[0_10px_28px_rgba(30,53,34,0.08)] backdrop-blur-sm">
      <span>
        <strong className="block text-sm font-bold leading-4 text-foreground">
          {value}
        </strong>

        <span className="block pt-0.5 text-[10px] text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

function buildWellbeingActivity(
  entries: Array<{ createdAt: string }>,
  streakDays: number,
) {
  const activity = new Map<string, number>();

  const today = new Date();

  const endDate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );

  for (
    let dayOffset = 0;
    dayOffset < Math.max(0, streakDays);
    dayOffset += 1
  ) {
    const date = new Date(endDate);

    date.setUTCDate(date.getUTCDate() - dayOffset);

    activity.set(date.toISOString().slice(0, 10), 1);
  }

  for (const entry of entries) {
    const date = entry.createdAt.slice(0, 10);

    activity.set(
      date,
      (activity.get(date) ?? 0) + 1,
    );
  }

  return Array.from(
    activity,
    ([date, count]) => ({
      date,
      count,
    }),
  );
}

export function DashboardView() {
  const { data, isLoading, error, timeRange, setTimeRange } = useDashboardViewModel("7d");

  const activityWeeks = timeRange === "90d" ? 13 : timeRange === "30d" ? 4 : 1;
  const [hoveredMoodPoint, setHoveredMoodPoint] = useState<{
    point: { label: string; value: number };
    left: number;
    top: number;
  } | null>(null);
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(
    null,
  );
  const [moodSaveStatus, setMoodSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function saveMood(mood: QuickMood) {
    setMoodSaveStatus("saving");
    try {
      await assessmentService.recordMood(mood);
      setMoodSaveStatus("saved");
    } catch {
      setMoodSaveStatus("error");
    }
  }

  useEffect(() => {
    let active = true;

    void settingsService
      .get()
      .then((settings) => {
        if (active) {
          setSavedDisplayName(settings.profile.displayName);
        }
      })
      .catch(() => {
        // Dashboard content can still render if the optional profile refresh fails.
      });

    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return <LoadingState label="Loading your ECHO space..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Could not load dashboard"
        description={error ?? "No data available."}
      />
    );
  }

  const {
    userProfile,
    journalEntries,
    latestEntry,
    moodTrend,
    weeklyDigest,
  } = data;

  const riskScore = latestEntry?.riskScore ?? 0;

  // Filter entries based on the selected mood rhythm time range
  const now = new Date().getTime();
  const rangeDays = timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 7;
  const filteredEntries = journalEntries.filter((entry) => {
    const entryTime = new Date(entry.createdAt).getTime();
    return now - entryTime <= rangeDays * 24 * 60 * 60 * 1000;
  });

  const periodMoodCounts = new Map<string, number>();
  for (const entry of filteredEntries) {
    periodMoodCounts.set(entry.mood, (periodMoodCounts.get(entry.mood) ?? 0) + 1);
  }
  const periodTopMood =
    [...periodMoodCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    latestEntry?.mood ??
    "calm";

  const highestMoodValue = Math.max(
    ...moodTrend.map((point) => point.value),
    100,
  );

  const recentEntries = journalEntries.slice(0, 3);

  const wellbeingActivity = buildWellbeingActivity(
    journalEntries,
    userProfile.streakDays,
  );

  return (
    <EchoReveal direction="up" delay={0}>
      <div className="space-y-4 sm:space-y-5">

        {/* HERO */}
        <header className="echo-dashboard-hero relative isolate flex flex-col gap-5 overflow-hidden rounded-[2rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(120deg,rgba(251,247,238,0.94),rgba(220,232,214,0.72))] p-5 shadow-[0_18px_50px_rgba(30,53,34,0.08)] sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full bg-white/55 blur-3xl"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute bottom-0 right-[28%] h-32 w-32 rounded-full bg-[var(--landing-sage)]/20 blur-3xl"
            aria-hidden="true"
          />

          <div>
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.17em] text-[var(--landing-primary)]">
              <Leaf
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />

              Your reflection space
            </p>

            <h1 className="mt-2 text-[clamp(2.1rem,4vw,3.7rem)] font-medium leading-[0.95] tracking-[-0.055em] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              Good evening, {savedDisplayName ?? userProfile.name}
            </h1>

            <p className="mt-2 text-sm text-[var(--landing-muted)]">
              Take one quiet moment to notice how you are arriving today.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">

            {/* Gentle streak */}
            <TinyMetric
              value={`${userProfile.streakDays} days`}
              label="gentle streak"
            />

            {/* Entries */}
            <TinyMetric
              value={`${journalEntries.length} entries`}
              label="total reflections"
            />

            <Link
              href="/journal/new"
              className="hidden h-[52px] shrink-0 items-center gap-2 rounded-full bg-[var(--landing-primary)] px-5 text-sm font-bold text-[var(--landing-inverse)] shadow-subtle outline-none transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] hover:shadow-card focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97] xl:inline-flex"
            >
              <PenLine
                className="h-4 w-4"
                aria-hidden="true"
              />

              Write reflection
            </Link>
          </div>
        </header>

        <section aria-label="Mood check-in">
          <MoodCheckIn onSelect={(mood) => void saveMood(mood)} />
          <p
            className="mt-2 min-h-5 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {moodSaveStatus === "saving" && "Saving your private check-in..."}
            {moodSaveStatus === "saved" && "Your check-in was saved."}
            {moodSaveStatus === "error" &&
              "Your check-in could not be saved. Please try again."}
          </p>
        </section>

        <section aria-label="Optional PHQ-8 self-check">
          <Phq8CheckIn />
        </section>

        {/* DASHBOARD GRID */}
        <div className="echo-card-motion-grid grid gap-4 lg:grid-cols-12">

          {/* MOOD RHYTHM */}
          <DashboardCard className="bg-[linear-gradient(145deg,rgba(255,253,247,0.92),rgba(230,239,224,0.82))] lg:col-span-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Emotional balance
                </p>

                <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">
                  Mood rhythm
                </h2>
              </div>

              {/* Interactive Mood Rhythm Range Selector */}
              <label className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--landing-primary-15)] bg-white/90 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-white focus-within:ring-2 focus-within:ring-primary/30">
                <CalendarRange className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="cursor-pointer appearance-none bg-transparent pr-4 text-xs font-semibold outline-none text-foreground"
                  aria-label="Choose mood rhythm time range"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Previous month</option>
                  <option value="90d">Last 90 days</option>
                </select>
                <ChevronRight className="pointer-events-none absolute right-2 h-3 w-3 rotate-90 text-muted-foreground" aria-hidden="true" />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-background/75 p-3 shadow-sm border border-black/5">
                <p className="text-[10px] text-muted-foreground font-medium">
                  Average mood
                </p>

                <p className="mt-1 text-sm font-bold capitalize text-primary">
                  {periodTopMood}
                </p>
              </div>

              <div className="rounded-xl bg-background/75 p-3 shadow-sm border border-black/5">
                <p className="text-[10px] text-muted-foreground font-medium">
                  Reflections
                </p>

                <p className="mt-1 text-sm font-bold text-foreground">
                  {filteredEntries.length}
                </p>
              </div>

              <div className="rounded-xl bg-background/75 p-3 shadow-sm border border-black/5">
                <p className="text-[10px] text-muted-foreground font-medium">
                  Streak
                </p>

                <p className="mt-1 text-sm font-bold text-foreground">
                  {userProfile.streakDays} days
                </p>
              </div>
            </div>

            {/* Interactive Mood Rhythm Chart with Tooltips */}
            <div
              className="relative mt-5 flex h-24 items-end justify-between gap-2.5 sm:gap-3.5 px-1"
              aria-label={`Mood rhythm over ${timeRange === "30d" ? "the previous month" : timeRange === "90d" ? "the last 90 days" : "the last seven days"}`}
              onMouseLeave={() => setHoveredMoodPoint(null)}
            >
              {moodTrend.map((point, index) => {
                const isHovered = hoveredMoodPoint?.point.label === point.label;
                const barHeight = point.value > 0
                  ? Math.max(18, Math.round((point.value / highestMoodValue) * 72))
                  : 8;

                const barColor =
                  point.value >= 80
                    ? "bg-[#536733]"
                    : point.value >= 60
                    ? "bg-[#8fc89a]"
                    : point.value >= 40
                    ? "bg-[#a9b89a]"
                    : point.value > 0
                    ? "bg-[#c98483]"
                    : "bg-black/10";

                return (
                  <div
                    key={`${point.label}-${index}`}
                    className="group relative flex min-w-0 flex-1 max-w-[64px] flex-col items-center gap-1.5 cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredMoodPoint({
                        point,
                        left: rect.left + rect.width / 2,
                        top: rect.top - 8,
                      });
                    }}
                  >
                    <div className="flex h-[72px] w-full items-end rounded-t-2xl bg-secondary/40 px-1 sm:px-1.5 transition-colors group-hover:bg-secondary/70">
                      <div
                        className={`w-full rounded-t-xl transition-all duration-300 ${barColor} ${
                          isHovered ? "ring-2 ring-primary ring-offset-1" : ""
                        }`}
                        style={{
                          height: `${barHeight}px`,
                          opacity: point.value > 0 ? 1 : 0.45,
                        }}
                      />
                    </div>

                    <span className="truncate text-[10px] sm:text-[11px] font-bold text-muted-foreground group-hover:text-foreground">
                      {point.label}
                    </span>
                  </div>
                );
              })}

              {/* Floating Mood Point Tooltip */}
              {hoveredMoodPoint ? (
                <div
                  role="tooltip"
                  className="pointer-events-none fixed z-[160] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-2xl border border-white/20 bg-[#102718]/95 px-3.5 py-2 text-center text-xs font-medium text-[#fffaf0] shadow-xl backdrop-blur-md"
                  style={{
                    left: hoveredMoodPoint.left,
                    top: hoveredMoodPoint.top,
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-[#fffaf0]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          hoveredMoodPoint.point.value >= 80
                            ? "#536733"
                            : hoveredMoodPoint.point.value >= 60
                            ? "#8fc89a"
                            : hoveredMoodPoint.point.value >= 40
                            ? "#a9b89a"
                            : hoveredMoodPoint.point.value > 0
                            ? "#c98483"
                            : "#888",
                      }}
                    />
                    <span>{hoveredMoodPoint.point.label}</span>
                  </div>
                  <span className="text-[10px] text-[#fffaf0]/75">
                    {hoveredMoodPoint.point.value > 0
                      ? `Mood score: ${hoveredMoodPoint.point.value}/100`
                      : "No reflections in this interval"}
                  </span>
                </div>
              ) : null}
            </div>
          </DashboardCard>

          {/* CURRENT DISTRESS */}
          <DashboardCard className="bg-[linear-gradient(155deg,rgba(255,253,247,0.94),rgba(237,242,240,0.88))] lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Wellbeing signal
            </p>

            <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">
              Current distress
            </h2>

            <div className="mt-4 flex items-end gap-1.5">
              <span className="text-4xl font-semibold tracking-[-0.06em]">
                {riskScore}
              </span>

              <span className="pb-1 text-sm text-muted-foreground">
                / 100
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${riskScore}%`,
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <StatusPill
                tone={riskScore >= 40 ? "warm" : "calm"}
              >
                {riskScore >= 40
                  ? "Needs gentleness"
                  : "Steady"}
              </StatusPill>

              <HeartPulse
                className="h-5 w-5 text-primary"
                aria-hidden="true"
              />
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              A reflective signal to help you decide what might support you next.
            </p>
          </DashboardCard>

          {/* CHECK-IN PLAN */}
          <DashboardCard className="bg-[linear-gradient(150deg,rgba(255,253,247,0.94),rgba(245,235,221,0.78))] lg:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  A gentle next step
                </p>

                <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">
                  Your check-in plan
                </h2>
              </div>

              <span className="text-sm font-semibold text-primary">
                24%
              </span>
            </div>

            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-secondary">
              <span className="w-[30%] bg-primary" />
              <span className="w-[25%] bg-[hsl(var(--happy))]" />
              <span className="w-[20%] bg-[hsl(var(--calm))]" />
            </div>

            <ul className="mt-4 space-y-2.5">
              {[
                "Choose a check-in rhythm",
                "Save one grounding tool",
                "Set your privacy preferences",
              ].map((task, index) => (
                <li
                  key={task}
                  className="flex items-center gap-2.5 text-xs text-muted-foreground"
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full border ${
                      index === 0
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {index === 0 ? (
                      <Check
                        className="h-3 w-3"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>

                  {task}

                  <span className="ml-auto text-[10px]">
                    {index === 0 ? "done" : "5 min"}
                  </span>
                </li>
              ))}
            </ul>
          </DashboardCard>

          {/* REFLECTION SPACE */}
          <DashboardCard className="relative min-h-[250px] overflow-hidden lg:col-span-5">
            <div className="relative z-10 max-w-[60%] sm:max-w-[56%]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                Reflection space
              </p>

              <h2 className="mt-2 text-3xl font-medium leading-[0.98] tracking-[-0.05em] [font-family:var(--font-echo-display)] sm:text-4xl">
                Write what is present today
              </h2>

              <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
                Journaling can make room for the thoughts, feelings, and small details you want to hold.
              </p>

              <Link
                href="/journal/new"
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--landing-primary)] px-4 text-xs font-bold text-[var(--landing-inverse)] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]"
              >
                New entry

                <ArrowUpRight
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <Image
              src={reflectionLandscape}
              alt="A doorway on a quiet hillside"
              priority
              className="absolute bottom-0 right-0 h-full w-[46%] object-cover object-[59%_center] opacity-80 [mask-image:linear-gradient(to_left,black_66%,transparent)]"
            />
          </DashboardCard>

          {/* RECENT REFLECTIONS */}
          <DashboardCard className="lg:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Recent reflections
                </p>

                <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">
                  Keep close
                </h2>
              </div>

              <Link
                href="/journal"
                className="text-xs font-semibold text-primary"
              >
                See all
              </Link>
            </div>

            <div className="mt-3 divide-y divide-border/65">
              {recentEntries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/journal/${entry.id}`}
                  className="flex items-center gap-3 py-2.5 outline-none transition-colors hover:text-primary focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary">
                    <BookOpen
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-semibold text-foreground">
                      {entry.title}
                    </strong>

                    <span className="block truncate pt-0.5 text-[10px] text-muted-foreground">
                      {entry.createdAt}
                    </span>
                  </span>

                  <StatusPill
                    tone={
                      entry.mood === "anxious"
                        ? "warm"
                        : "sage"
                    }
                  >
                    {entry.mood}
                  </StatusPill>
                </Link>
              ))}
            </div>
          </DashboardCard>

          {/* WEEKLY DIGEST */}
          <DashboardCard className="lg:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Weekly digest
            </p>

            <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">
              This week&apos;s patterns
            </h2>

            <ul className="mt-4 space-y-3">
              {weeklyDigest
                .slice(0, 3)
                .map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-xs leading-5 text-muted-foreground"
                  >
                    <Sparkles
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />

                    {item}
                  </li>
                ))}
            </ul>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary/70 p-3">
              <Leaf
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />

              <p className="text-xs text-secondary-foreground">
                Small steps count. Let today be enough.
              </p>
            </div>
          </DashboardCard>

          {/* WELLBEING ACTIVITY */}
          <DashboardCard
            className="overflow-hidden lg:col-span-8"
            testId="wellbeing-activity-card"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Wellbeing activity
                </p>

                <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">
                  Your reflection rhythm
                </h2>

                <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                  A private view of the days you checked in, reflected, or made a little room for yourself.
                </p>
              </div>

              <div className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 text-xs font-semibold text-foreground shadow-subtle">
                <CalendarRange
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <span>Last {rangeDays} days</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-y border-border/60 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
              <div>
                <strong className="block text-3xl font-semibold tracking-[-0.055em] text-foreground">
                  {userProfile.streakDays} days
                </strong>

                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Current gentle check-in streak
                </span>
              </div>

              <div className="border-border/60 sm:border-l sm:pl-5">
                <strong className="block text-3xl font-semibold tracking-[-0.055em] text-foreground">
                  {journalEntries.length} entries
                </strong>

                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Private reflections kept close
                </span>
              </div>

              <StatusPill tone="sage">
                Most reflective in the morning
              </StatusPill>
            </div>

            <ReflectionActivityGraph
              data={wellbeingActivity}
              weeks={activityWeeks}
              cellSize={15}
              cellGap={4}
              ariaLabel="Wellbeing activity by day, Monday through Sunday"
              singularLabel="wellbeing activity"
              pluralLabel="wellbeing activities"
              className="mt-4"
            />

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span>
                Your rhythm remains private. Hover over a day for details.
              </span>

              <Link
                href="/journal"
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary outline-none hover:text-primary/80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                Open journal

                <ChevronRight
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </DashboardCard>

          {/* PRIVACY */}
          <DashboardCard className="overflow-hidden border-white/10 bg-[var(--landing-footer)] text-[var(--landing-inverse)] lg:col-span-4">
            <LockKeyhole
              className="h-5 w-5 text-primary-foreground/80"
              aria-hidden="true"
            />

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/65">
              Private by design
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-[-0.045em]">
              Your words stay yours.
            </h2>

            <p className="mt-2 text-xs leading-5 text-primary-foreground/72">
              Your reflections are a personal space. Review your privacy choices whenever you need.
            </p>

            <Link
              href="/settings/privacy"
              className="mt-4 inline-flex h-9 items-center rounded-xl bg-card px-3 text-xs font-semibold text-primary outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-card/90 focus-visible:ring-4 focus-visible:ring-white/25 active:scale-[0.97]"
            >
              Review privacy
            </Link>
          </DashboardCard>
        </div>

        <p className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <LockKeyhole
            className="h-3.5 w-3.5 text-primary"
            aria-hidden="true"
          />

          Your private reflections are for support, not diagnosis.
        </p>
      </div>
    </EchoReveal>
  );
}
