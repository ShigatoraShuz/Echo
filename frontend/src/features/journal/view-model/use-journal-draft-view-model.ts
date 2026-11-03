"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJournalService } from "@/services/journal/journal-service.factory";
import type { JournalDraft } from "../model/journal.model";

export function useJournalDraftViewModel() {
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const service = getJournalService();
  const pendingRead = useRef<ReturnType<typeof service.getDraft> | null>(null);

  const loadDraft = useCallback(async (reusePending = false) => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      let read = reusePending ? pendingRead.current : null;
      if (!read) {
        read = service.getDraft("current");
        pendingRead.current = read;
        const created = read;
        void read.finally(() => { if (pendingRead.current === created) pendingRead.current = null; }).catch(() => {});
      }
      const result = await read;
      if (current !== requestId.current) return;
      if (result.success) setDraft(result.data);
      else setError(result.error.message);
    } catch {
      if (current === requestId.current) setError("Your draft could not be loaded.");
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    const sequence = requestId;
    void loadDraft(true);
    return () => { sequence.current++; };
  }, [loadDraft]);

  const retry = useCallback(() => loadDraft(), [loadDraft]);
  return { draft, loading, error, retry };
}
