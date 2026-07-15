import type { DashboardService } from "./dashboard.service";
import { createDashboardMockAdapter } from "./dashboard.mock-adapter";
import { createDashboardHttpAdapter } from "./dashboard.http-adapter";

let instance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
  if (instance) return instance;

  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true" || !process.env.NEXT_PUBLIC_API_URL;

  instance = useMock
    ? createDashboardMockAdapter()
    : createDashboardHttpAdapter();

  return instance;
}

export function resetDashboardService(): void {
  instance = null;
}
