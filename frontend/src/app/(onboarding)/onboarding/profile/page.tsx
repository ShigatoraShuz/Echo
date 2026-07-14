import Link from "next/link";
import { ArrowRight, Bell, UserRound } from "lucide-react";
import { EchoCard, PageHeader, PrivacyNotice } from "@/components/echo/shared";
import { MoodSelector } from "@/components/echo/mood-selector";

export default function ProfileOnboardingPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
        <PageHeader
          label="Onboarding"
          title="Set up your check-in profile"
          description="Choose the basics ECHO can use for greetings, reminders, and reflection prompts."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <EchoCard title="Profile details" description="These fields are local UI placeholders until Supabase auth and profiles are connected.">
            <div className="space-y-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Display name</span>
                <span className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                  <input className="echo-input pl-10" placeholder="Mira" />
                </span>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Preferred check-in time</span>
                <input className="echo-input" type="time" defaultValue="20:30" />
              </label>
              <div className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex gap-3">
                  <Bell className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notification preferences</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Gentle check-in reminders can be enabled later from settings. They should never contain sensitive journal text.
                    </p>
                  </div>
                </div>
              </div>
              <Link href="/onboarding/setup" className="echo-button-primary w-full">
                Continue setup
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </EchoCard>

          <div className="space-y-6">
            <EchoCard title="Starting mood" description="This does not diagnose anything. It only sets the tone for the first reflection.">
              <MoodSelector initialMood="neutral" />
            </EchoCard>
            <PrivacyNotice />
          </div>
        </div>
    </div>
  );
}
