"use client";

import { useMemo } from "react";
import type { MoodTrendPoint } from "../model/insights.model";

interface EmotionTrendChartProps {
  points: MoodTrendPoint[];
}

/** Maps a mood score (0-100) to a named level */
function moodLabel(value: number) {
  if (value >= 80) return "Great";
  if (value >= 60) return "Good";
  if (value >= 40) return "Okay";
  if (value >= 20) return "Low";
  return "Difficult";
}

/** Maps a mood score to the landing theme colour palette */
function moodColor(value: number) {
  if (value >= 80) return "#536733"; // landing-primary (calm green)
  if (value >= 60) return "#8fc89a"; // landing-sage
  if (value >= 40) return "#a9b89a"; // landing-sage soft
  if (value >= 20) return "#c98483"; // landing-rose
  return "#8b7065";                  // muted warm
}

export function EmotionTrendChart({ points }: EmotionTrendChartProps) {
  const maxVal = useMemo(() => Math.max(...points.map((p) => p.value), 1), [points]);
  const minVal = useMemo(() => Math.min(...points.map((p) => p.value), 0), [points]);
  const range = maxVal - minVal || 1;

  // Build an SVG polyline from the points
  const W = 400;
  const H = 120;
  const PAD_X = 16;
  const PAD_Y = 12;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const coords = useMemo(() =>
    points.map((p, i) => ({
      x: points.length === 1 ? PAD_X + chartW / 2 : PAD_X + (i / (points.length - 1)) * chartW,
      y: PAD_Y + chartH - ((p.value - minVal) / range) * chartH,
      point: p,
    })),
    [points, minVal, range, chartW, chartH]
  );

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath =
    coords.length > 0
      ? `M${coords[0].x},${H - PAD_Y} ` +
        coords.map((c) => `L${c.x},${c.y}`).join(" ") +
        ` L${coords[coords.length - 1].x},${H - PAD_Y} Z`
      : "";

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-xs text-[var(--landing-muted)]">
          Save journal reflections to see your mood trend over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* SVG line chart */}
      <div className="relative overflow-hidden rounded-2xl bg-[var(--landing-surface)] p-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 120 }}
          aria-label="Mood trend line chart"
          role="img"
        >
          {/* Horizontal guide lines */}
          {[0.25, 0.5, 0.75, 1].map((frac) => (
            <line
              key={frac}
              x1={PAD_X}
              y1={PAD_Y + (1 - frac) * chartH}
              x2={W - PAD_X}
              y2={PAD_Y + (1 - frac) * chartH}
              stroke="rgba(47,53,39,0.06)"
              strokeWidth={1}
            />
          ))}

          {/* Filled area under the line */}
          <defs>
            <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#536733" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#536733" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {areaPath && (
            <path d={areaPath} fill="url(#moodGrad)" />
          )}

          {/* Line */}
          {coords.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#536733"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={5} fill="white" stroke="#536733" strokeWidth={2} />
              <circle cx={c.x} cy={c.y} r={2.5} fill={moodColor(c.point.value)} />
            </g>
          ))}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between px-4">
        {points.map((p, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
              {p.label}
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                backgroundColor: `${moodColor(p.value)}18`,
                color: moodColor(p.value),
              }}
            >
              {moodLabel(p.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-1">
        {[
          { label: "Great", color: "#536733" },
          { label: "Good", color: "#8fc89a" },
          { label: "Okay", color: "#a9b89a" },
          { label: "Low", color: "#c98483" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1 text-[10px] text-[var(--landing-muted)]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
