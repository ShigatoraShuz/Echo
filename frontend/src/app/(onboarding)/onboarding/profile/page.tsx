"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, UserRound, Clock, Loader2 } from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { PrivacyNotice } from "@/shared/components/echo";
import { MoodSelector } from "@/features/onboarding";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";

export default function ProfileOnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [checkInTime, setCheckInTime] = useState("20:30");
  const [, setSelectedMood] = useState("calm");
  const [buddyTone, setBuddyTone] = useState("gentle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const service = getOnboardingService();
    const result = await service.saveProfile({
      displayName: displayName.trim() || "Friend",
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      goals: "Daily reflection & emotional wellbeing",
      buddyTone,
    });

    if (result.success) {
      router.push("/onboarding/setup");
    } else {
      setError(result.error.message || "Could not save your profile. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <PageHeader
        label="Onboarding · Step 2 of 3"
        title="Set up your check-in profile"
        description="Choose the basics ECHO and Buddy will use for greetings, tone, and gentle reflection check-ins."
      />

      <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <EchoCard
          title="Profile details"
          description="Personalize your greeting and check-in cadence."
        >
          <div className="space-y-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Display name / Preferred name</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                <input
                  className="echo-input pl-10 h-11"
                  placeholder="e.g. Maya or Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Preferred check-in time</span>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                  <input
                    className="echo-input pl-10 h-11"
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                  />
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Buddy tone</span>
                <select
                  className="echo-input h-11 cursor-pointer"
                  value={buddyTone}
                  onChange={(e) => setBuddyTone(e.target.value)}
                >
                  <option value="gentle">Gentle & comforting</option>
                  <option value="grounded">Grounded & direct</option>
                  <option value="reflective">Inquisitive & reflective</option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex gap-3">
                <Bell className="mt-0.5 h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Gentle reflection pacing</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Reminders are calm and never display sensitive journal reflections on lock screens.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--landing-primary)] px-6 text-sm font-bold text-white shadow-sm outline-none transition-all hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-emerald-600/30 disabled:opacity-50 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving profile...</span>
                </>
              ) : (
                <>
                  <span>Continue to permissions</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </EchoCard>

        <div className="space-y-6">
          <EchoCard
            title="Starting reflection vibe"
            description="How are you arriving to ECHO today? This helps set the initial tone."
          >
            <MoodSelector initialMood="calm" onMoodSelect={(mood) => setSelectedMood(mood)} />
          </EchoCard>
          <PrivacyNotice />
        </div>
      </form>
    </div>
  );
}
