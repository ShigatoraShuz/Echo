"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "../model/dashboard.model";
import type { DashboardService } from "@/services/dashboard/dashboard.service";
import { getDashboardService } from "@/services/dashboard/dashboard-service.factory";
import { realAnalysisInsights } from "@/features/journal/model/real-analysis-insights";
import { normalizeError } from "@/shared/errors/normalize-error";

export function useDashboardViewModel(initialTimeRange = "7d", serviceOverride?: DashboardService) {
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const service = serviceOverride ?? getDashboardService();
  const active = useRef(true);
  const revision = useRef(0);
  // Pending reads only: no fulfilled private snapshot is cached between mounts.
  const pending = useRef(new Map<string, ReturnType<DashboardService["getDashboardData"]>>());

  useEffect(() => {
    active.current = true;
    const currentRevision = revision;
    const requests = pending.current;
    const clear = () => {
      active.current = false; currentRevision.current++; requests.clear();
      setData(null); setIsLoading(false); setError(null);
    };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    return () => {
      active.current = false; currentRevision.current++; requests.clear();
      window.removeEventListener("echo:sensitive-state-cleared", clear);
    };
  }, [service]);

  const load = useCallback(async (range: string) => {
    if (!active.current) return;
    const current = ++revision.current;
    setIsLoading(true); setError(null);
    try {
      let read = pending.current.get(range);
      if (!read) {
        read = service.getDashboardData(range);
        pending.current.set(range, read);
        const created = read;
        void read.finally(() => { if (pending.current.get(range) === created) pending.current.delete(range); }).catch(() => {});
      }
      const result = await read;
      if (!active.current || current !== revision.current) return;
      if (result.success) setData({ ...result.data, analysisInsights: realAnalysisInsights(result.data.analysisInsights) });
      else setError(result.error.message);
    } catch (cause) {
      if (active.current && current === revision.current) setError(normalizeError(cause).userMessage);
    } finally {
      if (active.current && current === revision.current) setIsLoading(false);
    }
  }, [service]);

  useEffect(() => { void load(timeRange); }, [load, timeRange]);
  useEffect(() => {
    let disposed = false, queued = false;
    const refresh = () => {
      const read = pending.current.get(timeRange);
      if (!read) { void load(timeRange); return; }
      if (queued) return;
      queued = true;
      void read.finally(() => { queued = false; if (!disposed && active.current) void load(timeRange); }).catch(() => {});
    };
    window.addEventListener("echo:analysis-completed", refresh);
    window.addEventListener("echo:journal-changed", refresh);
    return () => { disposed = true; window.removeEventListener("echo:analysis-completed", refresh); window.removeEventListener("echo:journal-changed", refresh); };
  }, [load, timeRange]);

  return { data, isLoading, error, timeRange, setTimeRange, retry: () => load(timeRange) };
}
