"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight, HeartHandshake, Leaf, Sparkles } from "lucide-react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { env } from "@/config/environment";
import {
  acknowledgeSupportReturn,
  getSupportReturn,
  type SupportCheckIn,
  shouldOfferSupport,
  supportCheckInSchema,
} from "../model/support-journey";
import { SupportAction } from "./support-action";

type CheckIn =
  | { kind: "offer"; state: SupportCheckIn }
  | {
      kind: "return";
      state: SupportCheckIn;
      id: string;
      destination: "professional" | "grounding";
      completed: boolean;
    };

export function JournalSupportJourney({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [ready, setReady] = useState(false);
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const pending = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    let active = true,
      revision = 0,
      queued = false;
    const refresh = async (force = false) => {
      if (document.hidden || !active) return;
      if (force && pending.current) {
        if (!queued) {
          queued = true;
          void pending.current
            .finally(() => {
              queued = false;
              if (active) void refresh();
            })
            .catch(() => {});
        }
        return;
      }
      const current = ++revision;
      try {
        if (!pending.current) {
          const read = createApiClient({
            baseUrl: env.apiBaseUrl,
            tokenProvider: supabaseAuthTokenProvider,
          }).get<{ data: unknown }>("/journal-support/check-in", {
            timeout: 5000,
          });
          pending.current = read;
          void read
            .finally(() => {
              if (pending.current === read) pending.current = null;
            })
            .catch(() => {});
        }
        const response = (await pending.current) as { data: unknown };
        if (!active || current !== revision || queued) return;
        const state = supportCheckInSchema.parse(response.data);
        const visit = getSupportReturn(state.ownerId);
        if (visit) {
          setCheckIn({ kind: "return", state, ...visit });
        } else if (shouldOfferSupport(state)) {
          setCheckIn({ kind: "offer", state });
        }
      } catch {
        /* Unknown state is not a clinical flag. Urgent help and the rest of the app stay available. */
      } finally {
        if (active && current === revision && !queued) setCheckedPath(pathname);
      }
    };
    const changed = () => {
      void refresh(true);
    };
    const clear = () => {
      active = false;
      ++revision;
      pending.current = null;
      setCheckIn(null);
    };
    void refresh();
    window.addEventListener("echo:safety-support", changed);
    window.addEventListener("echo:analysis-completed", changed);
    window.addEventListener("echo:journal-changed", changed);
    window.addEventListener("echo:sensitive-state-cleared", clear);
    document.addEventListener("visibilitychange", changed);
    return () => {
      active = false;
      ++revision;
      window.removeEventListener("echo:safety-support", changed);
      window.removeEventListener("echo:analysis-completed", changed);
      window.removeEventListener("echo:journal-changed", changed);
      window.removeEventListener("echo:sensitive-state-cleared", clear);
      document.removeEventListener("visibilitychange", changed);
    };
  }, [pathname]);
  const returning = checkIn?.kind === "return";
  const visitId = checkIn?.kind === "return" ? checkIn.id : null;
  useEffect(() => {
    setReady(false);
  }, [visitId]);
  const message =
    checkIn?.kind === "return" && checkIn.completed
      ? checkIn.destination === "grounding"
        ? "You made time for a grounding practice. There is no need to feel a certain way before writing. Take this next page at your own pace."
        : "Your support request was submitted. A response may take time. While you wait, you can write a little, pause, or return to support options."
      : returning
        ? "You made space to explore support. You can write a little, take another pause, or come back later. There is no right pace."
        : "You deserve space to be heard. You don’t have to find the perfect words or handle everything on your own. Choose a next step before returning to writing: explore professional support or take a grounding pause.";
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
              onClick={() => {
                if (
                  ready &&
                  checkIn?.kind === "return" &&
                  acknowledgeSupportReturn(checkIn.state, checkIn.id)
                )
                  setCheckIn(null);
              }}
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
