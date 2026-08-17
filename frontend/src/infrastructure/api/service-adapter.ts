import { env } from "@/config/environment";
import type { DataAdapter } from "@/config/environment";

export interface ServiceAdapter {
  readonly name: DataAdapter;
}

export function isMockAdapter(): boolean {
  return env.dataAdapter === "mock";
}

export function isHttpAdapter(): boolean {
  return env.dataAdapter === "http";
}
