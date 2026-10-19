"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, CheckCircle2, Smartphone, Loader2, Sparkles } from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { EchoImage } from "@/shared/components/ui";
import { PrivacyNotice } from "@/shared/components/echo";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";
import { ONBOARDING_STEPS, StepProgress } from "@/features/onboarding";

export default function SetupOnboardingPage() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [facialAnalysisEnabled, setFacialAnalysisEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async () => {
    setIsSubmitting(true);
    setError(null);

    const service = getOnboardingService();

    // 1. Save setup preferences
    const setupResult = await service.saveSetup({
      theme: "system",
      notifications: notificationsEnabled,
      facialAnalysis: facialAnalysisEnabled,
    });

    if (!setupResult.success) {
      setError(setupResult.error.message || "Could not save your preferences.");
      setIsSubmitting(false);
      return;
    }

    // 2. Mark onboarding completed in database
    const completeResult = await service.completeOnboarding();
    if (completeResult.success) {
      router.push("/dashboard");
    } else {
      setError(completeResult.error.message || "Could not complete onboarding. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        label="Onboarding · Step 3 of 3"
        title="Finish setup & enter ECHO"
        description="Review optional camera and notification preferences before opening your private dashboard."
      />
      <StepProgress steps={ONBOARDING_STEPS} currentStep={2} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-6">
          <EchoImage imageKey="meditationRoomPlant" className="aspect-[4/3]" priority />
          <PrivacyNotice />
        </section>

        <EchoCard
          title="Permissions & Privacy"
          description="You maintain complete control. Every setting can be adjusted anytime from Settings."
        >
          <div className="space-y-4">
            {/* Camera / Facial Trend Permission Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <Camera className="mt-0.5 h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Facial emotion analysis is optional</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Camera check-ins run only when you explicitly start them. Video is processed locally and never stored.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFacialAnalysisEnabled(!facialAnalysisEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    facialAnalysisEnabled ? "bg-[var(--landing-primary)]" : "bg-muted"
                  }`}
                  role="switch"
                  aria-checked={facialAnalysisEnabled}
                  aria-label="Allow optional camera check-ins"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      facialAnalysisEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Notification Permission Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <Smartphone className="mt-0.5 h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notification preference</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Get an in-app update when an optional journal analysis is ready. Set daily reminders and device alerts separately in Settings when those channels are available.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    notificationsEnabled ? "bg-[var(--landing-primary)]" : "bg-muted"
                  }`}
                  role="switch"
                  aria-checked={notificationsEnabled}
                  aria-label="Analysis-ready updates in app"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      notificationsEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Readiness Indicator */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-[var(--landing-primary)] font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Your choices are ready to save</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Open your dashboard after saving. Buddy access and journal analysis depend on their separate checks and availability.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--landing-primary)] px-6 text-sm font-bold text-white shadow-sm outline-none transition-all hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-emerald-600/30 disabled:opacity-50 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Entering your private space...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Open dashboard</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </EchoCard>
      </div>
    </div>
  );
}
