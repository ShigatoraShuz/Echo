import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Moon,
  PenLine,
  Shield,
  Sparkles,
} from "lucide-react";
import { ThemeControls } from "@/components/echo/theme-controls";
import {
  echoChartTokens,
  moodNames,
  moodStyles,
} from "@/lib/theme";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoBadge } from "@/shared/components/ui/echo-badge";
import { EchoDivider } from "@/shared/components/ui/echo-divider";
import { EchoProgress } from "@/shared/components/ui/echo-progress";
import { EchoStatCard } from "@/shared/components/data-display/echo-stat-card";
import { EchoMoodIndicator } from "@/shared/components/data-display/echo-mood-indicator";
import { EchoRiskIndicator } from "@/shared/components/data-display/echo-risk-indicator";
import { EchoPageHeading } from "@/shared/components/data-display/echo-page-heading";
import { EchoEmptyState } from "@/shared/components/feedback/echo-empty-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { EchoStatusBanner } from "@/shared/components/feedback/echo-status-banner";
import { EchoInput } from "@/shared/components/ui/echo-input";
import { EchoSwitch } from "@/shared/components/ui/echo-switch";
import { EchoCrisisBanner } from "@/shared/components/crisis/echo-crisis-banner";

const colorTokens = [
  "background",
  "foreground",
  "card",
  "primary",
  "secondary",
  "muted",
  "accent",
  "success",
  "warning",
  "danger",
  "crisis",
  "crisis-soft",
  "calm",
  "happy",
  "neutral",
  "sad",
  "anxious",
  "angry",
  "border",
  "input",
  "ring",
];

const chartBars = [
  { label: "Mon", value: "42%", token: "var(--chart-1)" },
  { label: "Tue", value: "58%", token: "var(--chart-2)" },
  { label: "Wed", value: "36%", token: "var(--chart-3)" },
  { label: "Thu", value: "72%", token: "var(--chart-4)" },
  { label: "Fri", value: "50%", token: "var(--chart-5)" },
];

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <EchoCard title={title} description={description}>
      {children}
    </EchoCard>
  );
}

function TokenSwatch({ token }: { token: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-3">
      <div className="h-16 rounded-xl border border-border/70" style={{ background: `hsl(var(--${token}))` }} />
      <div className="mt-3">
        <p className="text-sm font-semibold text-foreground">{token}</p>
        <p className="text-xs text-muted-foreground">{`hsl(var(--${token}))`}</p>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10">
        <EchoPageHeading
          title="Theme consistency preview"
          description="Token-driven surfaces for mood tracking, risk bands, journaling, Buddy Chat, and crisis support."
          badge={<span className="text-xs font-medium text-primary">ECHO Design System</span>}
          action={
            <div className="flex w-full flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-subtle lg:w-[420px]">
              <ThemeControls compact />
              <div className="flex flex-wrap gap-2">
                <Link href="/settings/profile" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-sm font-semibold text-foreground shadow-subtle transition hover:bg-muted">
                  Profile
                </Link>
                <Link href="/settings/privacy" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-sm font-semibold text-foreground shadow-subtle transition hover:bg-muted">
                  Privacy
                </Link>
              </div>
            </div>
          }
        />

        <EchoDivider className="my-8" />

        <div className="space-y-6">
          <Section title="Color Tokens" description="Every visible color is read from CSS variables and Tailwind semantic tokens.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {colorTokens.map((token) => (
                <TokenSwatch key={token} token={token} />
              ))}
            </div>
          </Section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <Section title="Typography Scale" description="Serif display headings with quiet, readable system text for app chrome.">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display</p>
                  <p className="font-serif text-5xl font-semibold tracking-tight text-foreground">
                    Calm insight, clear next step.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Heading</p>
                  <p className="text-2xl font-semibold tracking-tight text-foreground">
                    Your week shows steadier evenings.
                  </p>
                </div>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  ECHO copy uses soft contrast, generous line-height, and restrained weight changes so reflective surfaces stay easy to scan.
                </p>
                <p className="text-sm font-medium text-foreground">Control label</p>
                <p className="text-xs text-muted-foreground">Caption and helper text</p>
              </div>
            </Section>

            <Section title="Buttons" description="Primary, secondary, and quiet actions share one shape and focus treatment.">
              <div className="flex flex-wrap gap-3">
                <EchoButton variant="primary" size="medium">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  New reflection
                </EchoButton>
                <EchoButton variant="secondary" size="medium">
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  Night check-in
                </EchoButton>
                <EchoButton variant="ghost" size="medium">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  Continue
                </EchoButton>
              </div>
              <EchoDivider label="Loading state" />
              <EchoButton variant="primary" size="medium" isLoading loadingText="Saving...">
                Save
              </EchoButton>
              <EchoDivider label="Sizes" />
              <div className="flex flex-wrap items-center gap-3">
                <EchoButton variant="primary" size="small">Small</EchoButton>
                <EchoButton variant="primary" size="medium">Medium</EchoButton>
                <EchoButton variant="primary" size="large">Large</EchoButton>
                <EchoButton variant="outline" size="small">Outline</EchoButton>
                <EchoButton variant="soft" size="small">Soft</EchoButton>
                <EchoButton variant="danger" size="small">Danger</EchoButton>
                <EchoButton variant="link" size="small">Link</EchoButton>
              </div>
            </Section>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Section title="Badges" description="EchoBadge supports default, success, warning, danger, info, and neutral variants.">
              <div className="flex flex-wrap gap-2">
                <EchoBadge variant="default">Default</EchoBadge>
                <EchoBadge variant="success">Success</EchoBadge>
                <EchoBadge variant="warning">Warning</EchoBadge>
                <EchoBadge variant="danger">Danger</EchoBadge>
                <EchoBadge variant="info">Info</EchoBadge>
                <EchoBadge variant="neutral">Neutral</EchoBadge>
              </div>
              <EchoDivider label="Sizes" />
              <div className="flex flex-wrap items-center gap-2">
                <EchoBadge variant="default" size="small">Small</EchoBadge>
                <EchoBadge variant="default" size="medium">Medium</EchoBadge>
              </div>
            </Section>

            <Section title="Progress" description="EchoProgress with percentage display and semantic variants.">
              <EchoProgress value={75} label="Emotional awareness" showValue variant="default" />
              <EchoProgress value={45} label="Journal entries" showValue variant="warning" />
              <EchoProgress value={90} label="Check-in streak" showValue variant="success" />
              <EchoProgress value={30} size="small" label="Small variant" />
            </Section>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Section title="Mood & Risk Indicators" description="Visual mood and risk signals using EchoMoodIndicator and EchoRiskIndicator.">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moods</p>
                <div className="flex flex-wrap items-center gap-4">
                  <EchoMoodIndicator mood="great" size="large" showLabel />
                  <EchoMoodIndicator mood="good" size="large" showLabel />
                  <EchoMoodIndicator mood="okay" size="large" showLabel />
                  <EchoMoodIndicator mood="bad" size="large" showLabel />
                  <EchoMoodIndicator mood="awful" size="large" showLabel />
                  <EchoMoodIndicator mood="unknown" size="large" showLabel />
                </div>
                <EchoDivider />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk bands</p>
                <div className="flex flex-wrap items-center gap-2">
                  <EchoRiskIndicator level="low" />
                  <EchoRiskIndicator level="medium" />
                  <EchoRiskIndicator level="high" />
                  <EchoRiskIndicator level="critical" />
                </div>
                <EchoDivider />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legacy Mood Badges</p>
                <div className="flex flex-wrap gap-2">
                  {moodNames.map((mood) => (
                    <span key={mood} className={moodStyles[mood]}>{mood}</span>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Stat Cards" description="EchoStatCard for metric display with trend indicators.">
              <div className="grid grid-cols-2 gap-4">
                <EchoStatCard label="Entries" value="24" trend="up" trendLabel="+3 this week" />
                <EchoStatCard label="Avg. Mood" value="3.8" trend="up" trendLabel="Stable" />
                <EchoStatCard label="Buddy replies" value="12" trend="down" trendLabel="-2 today" />
                <EchoStatCard label="Streak" value="7 days" />
              </div>
            </Section>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Section title="Forms" description="Inputs and form elements using EchoInput, EchoTextarea, EchoSelect, EchoCheckbox, and EchoSwitch.">
              <EchoInput label="Reflection title" placeholder="Evening check-in" required />
              <EchoInput label="Email" type="email" placeholder="you@example.com" description="We'll never share your email." />
              <EchoInput label="Error example" error="This field is required" />
              <EchoSwitch label="Dark mode" description="Apply the Night theme automatically" />
              <EchoDivider />
              <EchoButton variant="primary" size="medium">
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Save entry
              </EchoButton>
            </Section>

            <Section title="Charts" description="Chart fills and legends reference --chart-* theme variables.">
              <div className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="chart-card-grid flex h-56 items-end gap-3 rounded-xl border border-border/70 bg-card/70 p-4">
                  {chartBars.map((bar) => (
                    <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-xl shadow-subtle"
                        style={{ height: bar.value, background: `hsl(${bar.token})` }}
                      />
                      <span className="text-xs font-medium text-muted-foreground">{bar.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {echoChartTokens.map((token, index) => (
                    <span key={token} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: token }} aria-hidden="true" />
                      Chart {index + 1}
                    </span>
                  ))}
                </div>
              </div>
            </Section>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Section title="Feedback States" description="EchoEmptyState, EchoErrorState, EchoLoadingState, EchoInlineMessage, EchoStatusBanner.">
              <EchoEmptyState title="No entries yet" description="Start with a short note whenever you are ready." />
              <EchoErrorState title="Could not sync" message="Your local journal content remains available." compact />
              <EchoLoadingState variant="spinner" label="Preparing the weekly pattern summary..." />
              <EchoDivider />
              <EchoInlineMessage variant="info" message="Your data is stored locally." />
              <EchoInlineMessage variant="success" message="Entry saved successfully." />
              <EchoInlineMessage variant="warning" message="Storage is reaching its limit." />
              <EchoInlineMessage variant="error" message="Could not connect to the server." />
            </Section>

            <Section title="Crisis UI" description="EchoCrisisBanner — always accessible, never behind a feature flag.">
              <EchoCrisisBanner />
              <EchoDivider label="Compact variant" />
              <EchoCrisisBanner compact />
            </Section>

            <Section title="Status Banner" description="EchoStatusBanner for page-level notifications.">
              <EchoStatusBanner variant="info" title="New feature available" description="Try the improved check-in flow." dismissible />
              <EchoStatusBanner variant="success" title="Backup complete" />
              <EchoStatusBanner variant="warning" title="Storage warning" description="You're using 85% of your available space." dismissible />
              <EchoStatusBanner variant="error" title="Sync failed" description="Check your connection and try again." />
            </Section>
          </section>

          <Section title="Cards" description="EchoCard with header, footer, and body spacing.">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Privacy-first</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Sensitive UI stays quiet and readable.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Consistent shells</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Pages share the same outer structure.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
                <Sparkles className="h-5 w-5 text-accent-foreground" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Soft by default</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Alerts can rise without breaking the palette.</p>
              </div>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
