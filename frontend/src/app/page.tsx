import Link from "next/link";
import { ArrowRight, Bot, LineChart, Lock, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import { EchoCard, EchoImage, FeatureCard, PrivacyNotice } from "@/components/echo/shared";
import { PublicShell } from "@/components/echo/shells";

export default function HomePage() {
  return (
    <PublicShell>
      <main>
        <section className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:px-6 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-14 xl:px-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                ECHO
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                A calm private space for journaling, reflective Buddy support, and non-diagnostic wellbeing signals.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="echo-button-primary">
                Start privately
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/crisis-help" className="echo-button-secondary">
                Crisis resources
              </Link>
            </div>
            <PrivacyNotice />
          </div>

          <div className="grid gap-4">
            <EchoImage imageKey="calmChairPlant" className="aspect-[5/4]" priority />
            <div className="grid gap-4 sm:grid-cols-3">
              <EchoCard compact className="bg-card/90">
                <PenLine className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-foreground">Journal privately</p>
              </EchoCard>
              <EchoCard compact className="bg-card/90">
                <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-foreground">Talk with Buddy</p>
              </EchoCard>
              <EchoCard compact className="bg-card/90">
                <LineChart className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-foreground">Review patterns</p>
              </EchoCard>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-secondary/20">
          <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8 xl:px-10">
            <FeatureCard
              icon={<Lock className="h-5 w-5" aria-hidden="true" />}
              title="Private by default"
              description="Entries and preferences are framed as personal reflections with export controls ready for future backend work."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
              title="Warm guidance"
              description="Buddy prompts focus on grounding, naming feelings, and choosing one gentle next step."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
              title="Safety-aware"
              description="Crisis support is always reachable, and distress signals are never presented as diagnosis."
            />
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
