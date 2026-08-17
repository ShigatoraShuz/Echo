import type { DashboardData } from "@/features/dashboard/model/dashboard.model";
import type { ServiceResult } from "@/infrastructure/api/service-result";

export interface DashboardService {
  getDashboardData(timeRange?: string): Promise<ServiceResult<DashboardData>>;
}
