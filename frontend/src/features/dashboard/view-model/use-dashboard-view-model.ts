"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "../model/dashboard.model";
import { getDashboardService } from "../services/dashboard-service.factory";

export function useDashboardViewModel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const service = getDashboardService();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await service.getDashboardData();
    if (result.success) {
      setData(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [service]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, retry: load };
}
