"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, HeartHandshake, Leaf, Sparkles } from "lucide-react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { useJournalSupportJourneyViewModel } from "../view-model/use-journal-support-journey-view-model";
import { SupportAction } from "./support-action";

export function JournalSupportJourney({ children }: { children?: ReactNode }) {
  const { pathname, checkIn, ready, setReady, checkedPath, returning, message, acknowledge } = useJournalSupportJourneyViewModel();
  return (
    <>
      <div
        className="min-w-0"
        data-journal-support-gate=""
        aria-busy={checkedPath !== pathname}
        inert={checkedPath !== pathname || Boolean(checkIn)}
      >
        {children}
      </div>
      <EchoDialog
        open={Boolean(checkIn)}
        onClose={() => {}}
        dismissible={false}
        title={
          returning
            ? "A softer place to begin again"
            : "Let’s make room for support"
        }
        className="support-checkin-dialog"
        size="large"
      >
        <div className="support-checkin-art" aria-hidden="true">
          <span className="support-orbit support-orbit-one" />
          <span className="support-orbit support-orbit-two" />
          <span className="support-orbit support-orbit-three" />
          <span className="support-art-core">
            <Leaf size={32} />
          </span>
          <Sparkles className="support-art-spark" size={19} />
        </div>
        <p className="support-eyebrow">
          {returning ? "Your next page, at your pace" : "A quiet check-in"}
        </p>
        <p className="support-checkin-message">{message}</p>
        {returning ? (
          <div className="space-y-3">
            <label className="support-readiness-agreement">
              <input
                type="checkbox"
                checked={ready}
                onChange={(event) => setReady(event.target.checked)}
              />
              <span>
                I feel ready to continue writing. I can pause or return to
                support at any time.
              </span>
            </label>
            <button
              type="button"
              className="support-choice support-choice-primary w-full justify-center"
              disabled={!ready}
              onClick={acknowledge}
            >
              I’m ready to write <ArrowRight size={17} aria-hidden="true" />
            </button>
            <SupportAction
              destination="grounding"
              className="support-choice support-choice-secondary w-full justify-center"
            >
              Take another grounding pause
            </SupportAction>
          </div>
        ) : (
          <div className="support-checkin-choices">
            <SupportAction
              destination="professional"
              className="support-choice support-choice-primary"
            >
              <HeartHandshake size={23} aria-hidden="true" />
              <span>
                <strong>Talk to a professional</strong>
                <small>Explore support and appointment requests</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </SupportAction>
            <SupportAction
              destination="grounding"
              className="support-choice support-choice-secondary"
            >
              <Leaf size={23} aria-hidden="true" />
              <span>
                <strong>Try a grounding exercise</strong>
                <small>A gentle pause, here and now</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </SupportAction>
          </div>
        )}
        <p className="mt-5 text-xs leading-6 text-muted-foreground">
          If you may be in immediate danger, contact local emergency services
          now. Professional requests may take time; grounding is optional.
        </p>
        <Link
          href="/crisis-help"
          className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
        >
          Immediate support options <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </EchoDialog>
    </>
  );
}
