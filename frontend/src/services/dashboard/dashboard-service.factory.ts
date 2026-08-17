import type { DashboardService } from "@/services/dashboard/dashboard.service";
import { createDashboardMockAdapter } from "@/services/dashboard/dashboard.mock-adapter";
import { createDashboardHttpAdapter } from "@/services/dashboard/dashboard.http-adapter";
import { isMockAdapter } from "@/infrastructure/api/service-adapter";

let instance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
  if (instance) return instance;

  instance = isMockAdapter()
    ? createDashboardMockAdapter()
    : createDashboardHttpAdapter();

  return instance;
}

export function resetDashboardService(): void {
  instance = null;
}
