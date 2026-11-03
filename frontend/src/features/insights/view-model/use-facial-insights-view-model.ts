"use client";

import { useEffect, useState } from "react";
import { getFacialHistory, type FacialHistoryEntry } from "@/services/insights/facial-history.service";

export function useFacialInsightsViewModel() {
  const [history, setHistory] = useState<FacialHistoryEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const abort = new AbortController();
    void getFacialHistory(abort.signal)
      .then((rows) => {
        if (!abort.signal.aborted) {
          setHistory(rows);
          setState("ready");
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setState("unavailable");
      });
    return () => abort.abort();
  }, []);

  return { history, state };
}
