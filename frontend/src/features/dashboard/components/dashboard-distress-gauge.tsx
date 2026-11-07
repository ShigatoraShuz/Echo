"use client";

import Link from "next/link";
import { useId, type CSSProperties } from "react";
import { ArrowUpRight, Activity } from "lucide-react";
import type { JournalAnalysisResult } from "@echo/contracts";
import styles from "./dashboard-distress-gauge.module.css";

const bands = ["low", "mild", "moderate", "high", "severe"] as const;
const colors = ["#80ad9a", "#a9b589", "#c6b77d", "#c8a07f", "#b88f8b"];
function point(degrees: number, radius = 102) {
  const angle = degrees * Math.PI / 180;
  return `${140 + Math.cos(angle) * radius},${137 - Math.sin(angle) * radius}`;
}

export function DashboardDistressGauge({ result }: { result?: JournalAnalysisResult | null }) {
  const id = useId().replace(/:/g, "");
  // Dataset categories and class confidence cannot establish distress intensity.
  const estimate = result?.schemaVersion === "echo-journal-analysis-v3" ? result.distressEstimate : undefined;
  const prompted = !result?.isSimulated && estimate?.status === "available";
  const band = prompted ? estimate.band : result?.schemaVersion === "echo-journal-analysis-v1" && !result.isSimulated ? result.distressBand : null;
  const index = band ? bands.indexOf(band) : -1;
  const label = result?.isSimulated ? "Sample only" : band ?? (result ? "Not estimated" : "No analysis yet");
  const angle = index * 36 - 72;
  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Wellbeing signal</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">Distress level</h2>
        </div>
        <span className={styles.icon}><Activity size={17} aria-hidden="true" /></span>
      </div>
      <div className={styles.instrument} role={band ? "meter" : "img"}
        aria-label={`Distress level: ${label}`}
        {...(band ? { "aria-valuemin": 0, "aria-valuemax": 4, "aria-valuenow": index, "aria-valuetext": band } : {})}>
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
          {band ? <g transform="translate(140 137)"><g key={band} className={styles.needle} style={{"--needle-angle": `${angle}deg`} as CSSProperties}>
            <path d="M -3 3 L 0 -87 L 3 3 Z" fill={`url(#${id}-needle)`} />
          </g><circle r="10" fill="#fbfaf4" stroke="#c7d6ca" /><circle r="4" fill="#285b49" /></g>
            : <g opacity=".55"><circle cx="140" cy="130" r="15" fill="none" stroke="#a8bcb0" strokeDasharray="2 5" /><path d="M 134 130 H 146" stroke="#678879" strokeWidth="2" strokeLinecap="round" /></g>}
          <text x="27" y="161" className={styles.scale}>Lower</text><text x="253" y="161" textAnchor="end" className={styles.scale}>Higher</text>
        </svg>
      </div>
      <div className={styles.reading}>
        <p className={styles.value}>{label}</p>
        <span className={styles.caption}>{result?.isSimulated ? "Development example" : prompted ? "Experimental AI estimate" : band ? "Latest saved analysis" : "Intensity unavailable"}</span>
      </div>
      <p className={styles.note}>{result?.isSimulated ? "Sample data does not describe your wellbeing." : prompted ? "Estimated from your latest reflection. Not a clinical assessment or safety rating." : band ? "A reflection signal, not a diagnosis or a measure of your safety." : estimate ? "No distress level was estimated for this reflection. No level is assumed." : result ? "This saved analysis has no distress-level estimate. No level is assumed." : "Save a reflection to begin. No reading does not mean low distress."}</p>
      <Link href="/insights/risk" className={styles.link}>About this reading <ArrowUpRight size={14} aria-hidden="true" /></Link>
    </div>
  );
}
