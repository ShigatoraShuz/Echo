import type { DashboardService } from "@/services/dashboard/dashboard.service";
import { createDashboardHttpAdapter } from "@/services/dashboard/dashboard.http-adapter";

let instance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
  if (instance) return instance;

  instance = createDashboardHttpAdapter();

  return instance;
}

export function resetDashboardService(): void {
  instance = null;
}
