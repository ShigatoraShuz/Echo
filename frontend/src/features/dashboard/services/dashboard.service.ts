import type { DashboardData } from "../model/dashboard.model";
import type { ServiceResult } from "@/shared/services/service-result";

export interface DashboardService {
  getDashboardData(): Promise<ServiceResult<DashboardData>>;
}
