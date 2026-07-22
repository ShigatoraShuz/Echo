"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Flame,
  HeartPulse,
  Lock,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { ErrorState, LoadingState } from "@/shared/components/legacy";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { useDashboardViewModel } from "../view-model/use-dashboard-view-model";

function DashboardPanel({
  children,
  className = "",
  featured = false,
}: {
  children: ReactNode;
  className?: string;
  featured?: boolean;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-[1.25rem] border p-5 shadow-subtle transition-[border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:shadow-card ${
        featured
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/70 bg-card text-card-foreground"
      } ${className}`}
    >
      {children}
    </section>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  icon,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  featured?: boolean;
}) {
  return (
    <DashboardPanel featured={featured} className="echo-dashboard-span-3 min-h-[112px]">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-xs font-medium ${featured ? "text-primary-foreground/72" : "text-muted-foreground"}`}>{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
          <p className={`mt-1 truncate text-xs ${featured ? "text-primary-foreground/66" : "text-muted-foreground"}`}>{detail}</p>
        </div>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${featured ? "bg-white/12 text-white" : "bg-secondary text-primary"}`}>
          {icon}
        </span>
      </div>
    </DashboardPanel>
  );
}

export function DashboardView() {
  const { data, isLoading, error } = useDashboardViewModel();

  if (isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (error || !data) {
    return <ErrorState title="Could not load dashboard" description={error ?? "No data available."} />;
  }

  const { userProfile, journalEntries, latestEntry, moodTrend, weeklyDigest } = data;
  const currentMood = latestEntry?.mood ?? "calm";
  const riskScore = latestEntry?.riskScore ?? 0;

  return (
    <>
      <h1 className="sr-only">Good evening, {userProfile.name}</h1>

      <EchoReveal direction="up" delay={0}>
        <div className="echo-dashboard-grid grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryTile
            label={`Good evening, ${userProfile.name}`}
            value={`${userProfile.streakDays} days`}
            detail="Current journaling streak"
            icon={<Flame className="h-5 w-5" aria-hidden="true" />}
          />
          <SummaryTile
            label="Recent reflections"
            value={`${journalEntries.length}`}
            detail="Entries ready to revisit"
            icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
          />
          <SummaryTile
            label="Next check-in"
            value={userProfile.nextCheckIn}
            detail="A gentle reminder is scheduled"
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          />
          <SummaryTile
            label="Your private space"
            value={userProfile.privacyStatus}
            detail="Local-first reflective support"
            featured
            icon={<Lock className="h-5 w-5" aria-hidden="true" />}
          />

          <DashboardPanel className="echo-dashboard-span-6 min-h-[268px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-primary">Emotional balance</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Mood rhythm</h2>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">Last 7 days</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-[11px] text-muted-foreground">Current mood</p>
                <p className="mt-1 text-lg font-semibold capitalize">{currentMood}</p>
              </div>
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-[11px] text-muted-foreground">Reflections</p>
                <p className="mt-1 text-lg font-semibold">{journalEntries.length}</p>
              </div>
              <div className="hidden rounded-xl bg-background/70 p-3 sm:block">
                <p className="text-[11px] text-muted-foreground">Streak</p>
                <p className="mt-1 text-lg font-semibold">{userProfile.streakDays} days</p>
              </div>
            </div>

            <div className="mt-6 flex h-24 items-end gap-2" aria-label="Seven-day mood trend">
              {moodTrend.map((point, index) => (
                <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span
                    className="w-full rounded-t-lg bg-primary/80"
                    style={{ height: `${Math.max(point.value, 16)}px`, opacity: 0.46 + index * 0.07 }}
                    title={`${point.label}: ${point.value}`}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">{point.label}</span>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel className="echo-dashboard-span-3 min-h-[268px]">
            <p className="text-xs font-medium text-primary">Wellbeing signal</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Current distress</h2>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight">{riskScore}</span>
              <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary" aria-label={`Distress signal ${riskScore} out of 100`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${riskScore}%` }} />
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">A reflective support signal, never a diagnosis.</p>
            <HeartPulse className="mt-4 h-7 w-7 text-primary" strokeWidth={1.7} aria-hidden="true" />
          </DashboardPanel>

          <DashboardPanel className="echo-dashboard-span-3 min-h-[268px] text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
              <UserRound className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">{userProfile.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your private ECHO space</p>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
              <div><p className="text-lg font-semibold">{journalEntries.length}</p><p className="text-[10px] text-muted-foreground">Entries</p></div>
              <div><p className="text-lg font-semibold">{userProfile.streakDays}</p><p className="text-[10px] text-muted-foreground">Day streak</p></div>
              <div><p className="text-lg font-semibold capitalize">{currentMood}</p><p className="text-[10px] text-muted-foreground">Mood</p></div>
            </div>
          </DashboardPanel>

          <DashboardPanel className="echo-dashboard-span-6 relative min-h-[270px]">
            <div className="relative z-10 max-w-md">
              <p className="text-xs font-medium text-primary">Reflection space</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Write what is present today</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Keep a private reflection, revisit your latest entry, or capture one small moment before it passes.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/journal/new" className="echo-button-primary h-10 px-4">
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  New entry
                </Link>
                {latestEntry ? (
                  <Link href={`/journal/${latestEntry.id}`} className="echo-button-secondary h-10 px-4">
                    Revisit latest
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </div>
            <BookOpen className="absolute -bottom-5 right-5 h-40 w-40 rotate-[-8deg] text-primary/10" strokeWidth={1.1} aria-hidden="true" />
          </DashboardPanel>

          <DashboardPanel className="echo-dashboard-span-3 min-h-[270px]">
            <p className="text-xs font-medium text-primary">Weekly digest</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Patterns noticed</h2>
            <div className="mt-5 space-y-4">
              {weeklyDigest.slice(0, 3).map((item) => (
                <div key={item} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <p className="text-sm leading-5 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel className="echo-dashboard-span-3 flex min-h-[270px] flex-col items-center justify-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
              <ShieldCheck className="h-8 w-8" strokeWidth={1.7} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">Keep your space safe</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Review privacy, security, and trusted-contact preferences.</p>
            <Link href="/settings/security" className="echo-button-primary mt-5 h-10 px-4">
              Update security
            </Link>
          </DashboardPanel>
        </div>
      </EchoReveal>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        ECHO offers reflective support and is not a diagnostic tool.
      </div>
    </>
  );
}
