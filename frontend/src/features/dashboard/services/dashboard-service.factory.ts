import type { DashboardService } from "./dashboard.service";
import { createDashboardMockAdapter } from "./dashboard.mock-adapter";
import { createDashboardHttpAdapter } from "./dashboard.http-adapter";
import { isMockAdapter } from "@/shared/services/service-adapter";

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
