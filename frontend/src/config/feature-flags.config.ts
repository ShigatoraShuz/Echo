import { env } from "@/config/environment";

export interface FeatureFlags {
  buddy: boolean;
  notifications: boolean;
  dataExport: boolean;
}

export const featureFlags: FeatureFlags = {
  buddy: env.enableBuddy,
  notifications: env.enableNotifications,
  dataExport: env.enableDataExport,
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}
