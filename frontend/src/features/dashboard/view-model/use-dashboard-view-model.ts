"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "../model/dashboard.model";
import type { DashboardService } from "@/services/dashboard/dashboard.service";
import { getDashboardService } from "@/services/dashboard/dashboard-service.factory";

export function useDashboardViewModel(initialTimeRange = "7d", serviceOverride?: DashboardService) {
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const service = serviceOverride ?? getDashboardService();
  const requestId = useRef(0);

  const load = useCallback(
    async () => {
      const currentRequest = ++requestId.current;
      setIsLoading(true);
      setError(null);
      const result = await service.getDashboardData(timeRange);
      if (currentRequest !== requestId.current) return;
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error.message);
      }
      setIsLoading(false);
    },
    [service, timeRange],
  );

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };
    window.addEventListener("echo:analysis-completed", refresh);
    return () => window.removeEventListener("echo:analysis-completed", refresh);
  }, [load]);

  return {
    data,
    isLoading,
    error,
    timeRange,
    setTimeRange,
    retry: load,
  };
}
