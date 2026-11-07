"use client";

import { useId, type CSSProperties } from "react";
import { ArrowUpRight, Activity } from "lucide-react";
import type { Phq8Assessment } from "@echo/contracts";
import styles from "./dashboard-phq8-gauge.module.css";

const bands = ["minimal", "mild", "moderate", "moderately_severe", "severe"] as const;
const colors = ["#80ad9a", "#a9b589", "#c6b77d", "#c8a07f", "#b88f8b"];
function point(degrees: number, radius = 102) {
  const angle = degrees * Math.PI / 180;
  return `${140 + Math.cos(angle) * radius},${137 - Math.sin(angle) * radius}`;
}

export function DashboardPhq8Gauge({ assessment, partial = false, due = true, onOpen, onStart }: {
  assessment?: Phq8Assessment | null; partial?: boolean; due?: boolean; onOpen: () => void; onStart: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const score = assessment?.score ?? null;
  const band = assessment?.severity ?? null;
  const index = band ? bands.indexOf(band) : -1;
  const label = score === null ? "No complete check-in" : `${score} / 24`;
  const angle = score === null ? -90 : score / 24 * 180 - 90;
  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Your check-in</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">PHQ-8 check-in</h2>
        </div>
        <span className={styles.icon}><Activity size={17} aria-hidden="true" /></span>
      </div>
      <div className={styles.instrument} role={band ? "meter" : "img"}
        aria-label={`PHQ-8 score: ${label}`}
        {...(band ? { "aria-valuemin": 0, "aria-valuemax": 24, "aria-valuenow": score!, "aria-valuetext": `${score} out of 24, ${band.replaceAll("_", " ")} symptoms` } : {})}>
        <svg viewBox="0 0 280 174" aria-hidden="true" className={styles.dial}>
          <defs>
            <radialGradient id={`${id}-halo`}><stop stopColor="#9cbfa9" stopOpacity=".22" /><stop offset="1" stopColor="#9cbfa9" stopOpacity="0" /></radialGradient>
            <linearGradient id={`${id}-needle`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#aebc90" /><stop offset="1" stopColor="#215747" /></linearGradient>
          </defs>
          <ellipse cx="140" cy="130" rx="119" ry="116" fill={`url(#${id}-halo)`} className={styles.halo} />
          <path d="M 22 137 A 118 118 0 0 1 258 137" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="1" />
          {bands.map((value, i) => <path key={value} d={`M ${point(178 - i * 36)} A 102 102 0 0 1 ${point(146 - i * 36)}`}
            fill="none" stroke={colors[i]} strokeWidth="11" strokeLinecap="round"
            opacity={band ? (i === index ? 1 : .36) : .32} className={styles.arc} style={{ animationDelay: `${i * 85}ms` }} />)}
          {Array.from({length: 21}, (_, i) => <path key={i} d={`M ${point(180 - i * 9, 83)} L ${point(180 - i * 9, i % 5 === 0 ? 74 : 79)}`}
            stroke="currentColor" strokeOpacity={i % 5 === 0 ? .35 : .13} strokeWidth={i % 5 === 0 ? 1.5 : 1} />)}
          {band ? <g transform="translate(140 137)"><g key={score} className={styles.needle} style={{"--needle-angle": `${angle}deg`} as CSSProperties}>
            <path d="M -3 3 L 0 -87 L 3 3 Z" fill={`url(#${id}-needle)`} />
          </g><circle r="10" fill="#fbfaf4" stroke="#c7d6ca" /><circle r="4" fill="#285b49" /></g>
            : <g opacity=".55"><circle cx="140" cy="130" r="15" fill="none" stroke="#a8bcb0" strokeDasharray="2 5" /><path d="M 134 130 H 146" stroke="#678879" strokeWidth="2" strokeLinecap="round" /></g>}
          <text x="27" y="161" className={styles.scale}>Lower</text><text x="253" y="161" textAnchor="end" className={styles.scale}>Higher</text>
        </svg>
      </div>
      <div className={styles.reading}>
        <p className={styles.value}>{label}</p>
        <span className={styles.caption}>{band ? `${band.replaceAll("_", " ")} symptoms · Self-reported` : "Based on your own answers"}</span>
      </div>
      <p className={styles.note}>{assessment ? <>Completed <time dateTime={assessment.completedAt}>{new Date(assessment.completedAt).toLocaleDateString()}</time>. Reflects the two weeks before that check-in; not a diagnosis or a safety rating.</> : "Answer eight questions about the last two weeks. No score is assumed before a complete check-in."}</p>
      {partial ? <p className={styles.note}>Your latest check-in is partial. {assessment ? "The gauge shows your latest complete check-in." : "Unanswered items are never scored as zero."}</p> : null}
      <button type="button" onClick={assessment || partial ? onOpen : onStart} className={styles.link}>{assessment || partial ? "View my check-in" : "Take PHQ-8 check-in"} <ArrowUpRight size={14} aria-hidden="true" /></button>
      {due && (assessment || partial) ? <button type="button" onClick={onStart} className={styles.link}>Take a new check-in <ArrowUpRight size={14} aria-hidden="true" /></button> : null}

    </div>
  );
}
