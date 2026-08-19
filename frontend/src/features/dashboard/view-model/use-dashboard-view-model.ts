"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "../model/dashboard.model";
import { getDashboardService } from "@/services/dashboard/dashboard-service.factory";

export function useDashboardViewModel(initialTimeRange = "7d") {
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const service = getDashboardService();

  const load = useCallback(async (range?: string) => {
    setIsLoading(true);
    setError(null);
    const targetRange = range ?? timeRange;
    const result = await service.getDashboardData(targetRange);
    if (result.success) {
      setData(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [service, timeRange]);

  const handleSetTimeRange = useCallback((newRange: string) => {
    setTimeRange(newRange);
    void load(newRange);
  }, [load]);

  useEffect(() => {
    void load(timeRange);
  }, [timeRange]);

  return {
    data,
    isLoading,
    error,
    timeRange,
    setTimeRange: handleSetTimeRange,
    retry: () => load(timeRange),
  };
}
