import { PhoneCall, MessageSquareText, ShieldAlert } from "lucide-react";
import { CrisisHelpCard, EchoCard, EchoImage, FeatureCard } from "@/shared/components/legacy";
import { PublicShell } from "@/shared/components/layout/echo-shells";
import { hotlines } from "@/lib/mock-data";

export default function CrisisHelpPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <section className="space-y-6">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Crisis help
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                If you might hurt yourself or someone else, contact emergency services now. ECHO is not a diagnostic tool.
              </p>
            </div>
            <CrisisHelpCard />
            <EchoImage imageKey="meditationRoomPlant" className="aspect-[4/3]" priority />
          </section>

          <section className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <FeatureCard icon={<PhoneCall className="h-5 w-5" aria-hidden="true" />} title="Call 988" description="Reach the Suicide & Crisis Lifeline in the United States." />
              <FeatureCard icon={<MessageSquareText className="h-5 w-5" aria-hidden="true" />} title="Text HOME" description="Send HOME to 741741 for Crisis Text Line support." />
              <FeatureCard icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />} title="Emergency" description="Call 911 if there is immediate danger." />
            </div>
            <EchoCard title="Hotline directory" description="Use the most urgent option first. These resources are informational and not a diagnosis.">
              <div className="grid gap-3">
                {hotlines.map((hotline) => (
                  <div key={hotline.name} className="rounded-2xl border border-border/70 bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">{hotline.name}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{hotline.action}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{hotline.description}</p>
                  </div>
                ))}
              </div>
            </EchoCard>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
