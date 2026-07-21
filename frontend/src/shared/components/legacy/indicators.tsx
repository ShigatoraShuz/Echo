import { moodStyles, riskBandStyles, type EchoMood, type EchoRiskBand } from "@/lib/theme";

export function MoodBadge({ mood }: { mood: EchoMood }) {
  return <span className={moodStyles[mood]}>{mood}</span>;
}

export function RiskBadge({ band }: { band: EchoRiskBand }) {
  return <span className={riskBandStyles[band]}>{band}</span>;
}

export function RiskScoreRing({
  score,
  band,
  label = "Distress signal",
}: {
  score: number;
  band: EchoRiskBand;
  label?: string;
}) {
  const safeScore = Math.max(0, Math.min(100, score));

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(hsl(var(--risk-${band})) ${safeScore * 3.6}deg, hsl(var(--risk-${band}-soft)) 0deg)`,
        }}
        aria-label={`${label}: ${safeScore} out of 100, ${band}`}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-center shadow-subtle">
          <span className="text-2xl font-semibold text-foreground">{safeScore}</span>
        </div>
      </div>
      <div className="space-y-2">
        <RiskBadge band={band} />
        <p className="text-sm leading-6 text-muted-foreground">
          {label} only. This is not a diagnosis or diagnostic tool.
        </p>
      </div>
    </div>
  );
}
