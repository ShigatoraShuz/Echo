"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getJournalSupportCheckIn } from "@/services/journal/support-check-in.service";
import {
  acknowledgeSupportReturn,
  getSupportReturn,
  type SupportCheckIn,
  shouldOfferSupport,
} from "../model/support-journey";

type CheckIn =
  | { kind: "offer"; state: SupportCheckIn }
  | {
      kind: "return";
      state: SupportCheckIn;
      id: string;
      destination: "professional" | "grounding";
      completed: boolean;
    };

export function useJournalSupportJourneyViewModel() {
  const pathname = usePathname();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [ready, setReady] = useState(false);
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const pending = useRef<Promise<SupportCheckIn> | null>(null);

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
          const read = getJournalSupportCheckIn();
          pending.current = read;
          void read
            .finally(() => {
              if (pending.current === read) pending.current = null;
            })
            .catch(() => {});
        }
        const state = await pending.current;
        if (!active || current !== revision || queued) return;
        const visit = getSupportReturn(state.ownerId);
        if (visit) setCheckIn({ kind: "return", state, ...visit });
        else if (shouldOfferSupport(state)) setCheckIn({ kind: "offer", state });
      } catch {
        /* Unknown state is not a clinical flag. Urgent help and the rest of the app stay available. */
      } finally {
        if (active && current === revision && !queued) setCheckedPath(pathname);
      }
    };
    const changed = () => { void refresh(true); };
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
  const visitId = returning ? checkIn.id : null;
  useEffect(() => { setReady(false); }, [visitId]);
  const message =
    checkIn?.kind === "return" && checkIn.completed
      ? checkIn.destination === "grounding"
        ? "You made time for a grounding practice. There is no need to feel a certain way before writing. Take this next page at your own pace."
        : "Your support request was submitted. A response may take time. While you wait, you can write a little, pause, or return to support options."
      : returning
        ? "You made space to explore support. You can write a little, take another pause, or come back later. There is no right pace."
        : "You deserve space to be heard. You don’t have to find the perfect words or handle everything on your own. Choose a next step before returning to writing: explore professional support or take a grounding pause.";

  const acknowledge = () => {
    if (ready && checkIn?.kind === "return" && acknowledgeSupportReturn(checkIn.state, checkIn.id)) setCheckIn(null);
  };

  return { pathname, checkIn, ready, setReady, checkedPath, returning, message, acknowledge };
}
