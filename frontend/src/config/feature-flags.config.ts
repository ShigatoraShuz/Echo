import { env } from "@/config/environment";

export interface FeatureFlags {
  buddy: boolean;
  facialAnalysis: boolean;
  riskInsights: boolean;
  notifications: boolean;
  dataExport: boolean;
}

export const featureFlags: FeatureFlags = {
  buddy: env.enableBuddy,
  facialAnalysis: env.enableFacialAnalysis,
  riskInsights: env.enableRiskInsights,
  notifications: env.enableNotifications,
  dataExport: env.enableDataExport,
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}
