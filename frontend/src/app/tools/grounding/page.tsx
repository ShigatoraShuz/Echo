import Link from "next/link";
import { Clock, Flame, HandHeart, Leaf, ShieldAlert, Wind } from "lucide-react";
import { BreathingCircle, CrisisHelpCard, EchoCard, FeatureCard, PageHeader } from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { userProfile } from "@/lib/mock-data";

const groundingCards = [
  { title: "5-4-3-2-1", description: "Name things you can see, feel, hear, smell, and taste.", icon: <HandHeart className="h-5 w-5" aria-hidden="true" /> },
  { title: "Window reset", description: "Look outside and describe colors, shapes, and movement.", icon: <Leaf className="h-5 w-5" aria-hidden="true" /> },
  { title: "Box breathing", description: "Inhale, hold, exhale, and hold for an even count.", icon: <Wind className="h-5 w-5" aria-hidden="true" /> },
];

export default function GroundingPage() {
  return (
    <AppShell>
      <PageHeader
        label="Tools"
        title="Grounding"
        description="A practical calming module for moments of stress. This is supportive, not diagnostic."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <EchoCard title="Breathing circle" description="Follow the expansion and contraction at a comfortable pace.">
            <BreathingCircle label="Inhale · Exhale" />
          </EchoCard>

          <div className="grid gap-5 md:grid-cols-3">
            {groundingCards.map((card) => (
              <FeatureCard key={card.title} icon={card.icon} title={card.title} description={card.description} />
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <EchoCard title="Session settings" description="Static controls ready for future local state.">
            <div className="space-y-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Duration</span>
                <select className="echo-input">
                  <option>2 minutes</option>
                  <option>5 minutes</option>
                  <option>10 minutes</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Pace</span>
                <select className="echo-input">
                  <option>Gentle</option>
                  <option>Slower</option>
                  <option>Steady</option>
                </select>
              </label>
              <button type="button" className="echo-button-primary w-full">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Start session
              </button>
            </div>
          </EchoCard>

          <EchoCard compact>
            <Flame className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-4 text-3xl font-semibold text-foreground">{userProfile.streakDays}</p>
            <p className="mt-1 text-sm text-muted-foreground">day daily practice streak</p>
          </EchoCard>

          <Link href="/crisis" className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-crisis-soft p-5">
            <ShieldAlert className="h-5 w-5 text-danger" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Need urgent help?</span>
          </Link>

          <CrisisHelpCard compact />
        </aside>
      </div>
    </AppShell>
  );
}
