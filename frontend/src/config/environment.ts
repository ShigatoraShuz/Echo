export const VALID_ADAPTER_VALUES = ["mock", "http"] as const;
export type DataAdapter = (typeof VALID_ADAPTER_VALUES)[number];

export interface EnvironmentConfig {
  apiBaseUrl: string;
  dataAdapter: DataAdapter;
  enableBuddy: boolean;
  enableFacialAnalysis: boolean;
  enableRiskInsights: boolean;
  enableNotifications: boolean;
  enableDataExport: boolean;
}

function parseBoolean(value: string | undefined): boolean {
  if (value === undefined) return false;
  const lower = value.trim().toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return false;
}

function validateAdapter(value: string | undefined): DataAdapter {
  if (value === undefined) return "mock";
  const lower = value.trim().toLowerCase();
  if (VALID_ADAPTER_VALUES.includes(lower as DataAdapter)) {
    return lower as DataAdapter;
  }
  console.error(
    `[ECHO Environment] Invalid NEXT_PUBLIC_DATA_ADAPTER value "${value}". Expected "mock" or "http". Falling back to "mock".`
  );
  return "mock";
}

export const env: EnvironmentConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",
  dataAdapter: validateAdapter(process.env.NEXT_PUBLIC_DATA_ADAPTER),
  enableBuddy: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_BUDDY),
  enableFacialAnalysis: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_FACIAL_ANALYSIS),
  enableRiskInsights: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_RISK_INSIGHTS),
  enableNotifications: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS),
  enableDataExport: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_DATA_EXPORT),
};
