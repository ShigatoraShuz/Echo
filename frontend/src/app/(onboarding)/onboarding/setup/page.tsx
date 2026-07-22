import Link from "next/link";
import { ArrowRight, Camera, CheckCircle2, Smartphone } from "lucide-react";
import { EchoCard, EchoImage, PageHeader, PrivacyNotice } from "@/shared/components/legacy";

export default function SetupOnboardingPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
        <PageHeader
          label="Onboarding"
          title="Finish setup"
          description="Review optional camera and notification permissions before opening the dashboard."
        />

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-6">
            <EchoImage imageKey="meditationRoomPlant" className="aspect-[4/3]" priority />
            <PrivacyNotice />
          </section>

          <EchoCard title="Permissions" description="Permission prompts are shown as clear explanations first, then user-controlled actions.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex gap-3">
                  <Camera className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Camera analysis is optional</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Facial trend sessions should start manually and show aggregated patterns only. They are not diagnostic.
                    </p>
                    <button type="button" className="mt-3 echo-button-secondary h-10 px-4">Ask later</button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex gap-3">
                  <Smartphone className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notifications stay gentle</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Reminder copy should stay private on lock screens and can be turned off anytime.
                    </p>
                    <button type="button" className="mt-3 echo-button-secondary h-10 px-4">Enable reminders</button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-success/30 bg-secondary/40 p-4">
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-foreground">Setup complete</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Your sample dashboard is ready.</p>
              </div>
              <Link href="/dashboard" className="echo-button-primary w-full">
                Open dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </EchoCard>
        </div>
    </div>
  );
}
