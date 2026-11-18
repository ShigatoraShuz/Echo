"use client";

import { ArrowUpRight, Activity } from "lucide-react";
import type { Phq8Assessment } from "@echo/contracts";
import {Phq8Meter} from '@/shared/components/phq8-meter';
import styles from "@/shared/components/phq8-meter.module.css";

export function DashboardPhq8Gauge({ assessment, partial = false, due = true, onOpen, onStart }: {
  assessment?: Phq8Assessment | null; partial?: boolean; due?: boolean; onOpen: () => void; onStart: () => void;
}) {
  const score = assessment?.score ?? null;
  const band = assessment?.severity ?? null;
  const label = score === null ? "No complete check-in" : `${score} / 24`;
  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Your check-in</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">PHQ-8 check-in</h2>
        </div>
        <span className={styles.icon}><Activity size={17} aria-hidden="true" /></span>
      </div>
      <Phq8Meter reading={assessment?{kind:'complete',score:assessment.score,severity:assessment.severity}:{kind:'unavailable'}} label={`PHQ-8 score: ${label}${band?', '+band.replaceAll('_',' ')+' symptoms':''}`}/>
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
