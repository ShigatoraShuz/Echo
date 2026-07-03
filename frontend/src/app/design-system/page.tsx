import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  HeartPulse,
  Loader2,
  MessageCircle,
  Moon,
  PenLine,
  Send,
  Shield,
  Sparkles,
} from "lucide-react";
import { ThemeControls } from "@/components/echo/theme-controls";
import {
  echoChartTokens,
  moodDotStyles,
  moodNames,
  moodStyles,
  riskBandNames,
  riskBandStyles,
} from "@/lib/theme";

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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6 lg:p-7">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TokenSwatch({ token }: { token: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-3">
      <div
        className="h-16 rounded-xl border border-border/70"
        style={{ background: `hsl(var(--${token}))` }}
      />
      <div className="mt-3">
        <p className="text-sm font-semibold text-foreground">{token}</p>
        <p className="text-xs text-muted-foreground">{`hsl(var(--${token}))`}</p>
      </div>
    </div>
  );
}

function MiniChart() {
  return (
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
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: token }}
              aria-hidden="true"
            />
            Chart {index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10">
        <header className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">ECHO Design System</p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Theme consistency preview
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Token-driven surfaces for mood tracking, risk bands, journaling, Buddy Chat, and crisis support.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-subtle lg:w-[420px]">
            <ThemeControls compact />
            <div className="flex flex-wrap gap-2">
              <Link href="/settings/profile" className="echo-button-secondary h-10 px-4">
                Profile
              </Link>
              <Link href="/settings/privacy" className="echo-button-secondary h-10 px-4">
                Privacy
              </Link>
            </div>
          </div>
        </header>

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
                <button className="echo-button-primary">
                  <Sparkles className="h-4 w-4" />
                  New reflection
                </button>
                <button className="echo-button-secondary">
                  <Moon className="h-4 w-4" />
                  Night check-in
                </button>
                <button className="echo-button-ghost">
                  <ArrowRight className="h-4 w-4" />
                  Continue
                </button>
              </div>
            </Section>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Section title="Mood Badges" description="Mood states are reusable classes mapped in src/lib/theme.ts.">
              <div className="flex flex-wrap gap-2">
                {moodNames.map((mood) => (
                  <span key={mood} className={moodStyles[mood]}>
                    {mood}
                  </span>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {moodNames.map((mood) => (
                  <div key={mood} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3">
                    <span className={`h-3 w-3 rounded-full ${moodDotStyles[mood]}`} />
                    <span className="text-sm font-medium capitalize text-foreground">{mood}</span>
                    <span className="ml-auto text-xs text-muted-foreground">mood.{mood}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Risk Badges" description="Risk bands use dedicated low, mild, moderate, high, and severe styles.">
              <div className="flex flex-wrap gap-2">
                {riskBandNames.map((risk) => (
                  <span key={risk} className={riskBandStyles[risk]}>
                    {risk}
                  </span>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {riskBandNames.map((risk) => (
                  <div key={risk} className={`risk-card risk-card-${risk}`}>
                    <p className="text-sm font-semibold capitalize">{risk}</p>
                    <p className="mt-1 text-xs leading-5">Reusable band surface</p>
                  </div>
                ))}
              </div>
            </Section>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Section title="Forms" description="Inputs and textareas use bg-background, border-input, and focus:ring tokens.">
              <form className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Reflection title</label>
                  <input className="echo-input" placeholder="Evening check-in" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Journal note</label>
                  <textarea className="echo-textarea" placeholder="A few calm sentences..." />
                </div>
                <button className="echo-button-primary" type="button">
                  <PenLine className="h-4 w-4" />
                  Save entry
                </button>
              </form>
            </Section>

            <Section title="Charts" description="Chart fills and legends reference --chart-* theme variables.">
              <MiniChart />
            </Section>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Section title="Crisis Alert Card" description="Crisis UI is stronger but still uses ECHO crisis and danger tokens.">
              <div className="rounded-2xl border border-danger/30 bg-crisis-soft p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-crisis text-danger-foreground">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Immediate support is available</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Reach a trusted person or emergency service if you may be in danger.
                    </p>
                  </div>
                </div>
                <button className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-crisis px-5 text-sm font-semibold text-danger-foreground shadow-subtle">
                  Get crisis resources
                </button>
              </div>
            </Section>

            <Section title="Journal Card" description="Journal entries keep soft elevation, mood context, and roomy text.">
              <article className="rounded-2xl border border-border/70 bg-background p-5 shadow-subtle">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Today, 8:42 PM</p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">A slower evening</h3>
                  </div>
                  <span className={moodStyles.calm}>calm</span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  The walk helped me reset. I noticed my shoulders soften after a few minutes outside.
                </p>
              </article>
            </Section>

            <Section title="Chat Bubble" description="Buddy Chat uses card, background, secondary, and border tokens.">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[70%] rounded-2xl rounded-tl-md border border-border/70 bg-background px-4 py-3 text-sm leading-6 shadow-subtle">
                    Want to name one thing that felt lighter today?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[70%] rounded-2xl rounded-tr-md bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground">
                    I made tea and sat near the window for a while.
                  </div>
                </div>
                <div className="flex items-end gap-3 rounded-2xl border border-border bg-background p-3">
                  <textarea className="min-h-11 flex-1 resize-none bg-transparent text-sm leading-6 outline-none" />
                  <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Section>
          </section>

          <Section title="Loading, Empty, Error" description="Operational states use the same panel rhythm and semantic status colors.">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background p-5">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Loading insight</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Preparing the weekly pattern summary.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background p-5">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">No entries yet</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Start with a short note whenever you are ready.</p>
              </div>
              <div className="rounded-2xl border border-danger/30 bg-crisis-soft p-5">
                <HeartPulse className="h-5 w-5 text-danger" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Could not sync</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Your local journal content remains available.</p>
              </div>
            </div>
          </Section>

          <Section title="Cards" description="The default ECHO card structure keeps headers, body spacing, borders, and shadows consistent.">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <article className="echo-compact-card">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Privacy-first</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Sensitive UI stays quiet and readable.</p>
              </article>
              <article className="echo-compact-card">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Consistent shells</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Pages share the same outer structure.</p>
              </article>
              <article className="echo-compact-card">
                <Sparkles className="h-5 w-5 text-accent-foreground" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Soft by default</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Alerts can rise without breaking the palette.</p>
              </article>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
