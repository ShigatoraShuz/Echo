import type { JournalEntry } from "@/features/journal/model/journal.model";
import type { DashboardInsights } from "@echo/contracts";

export interface TrendPoint {
  label: string;
  value: number;
}

export interface UserProfile {
  name: string;
  streakDays: number;
  nextCheckIn: string;
  privacyStatus: string;
}

export interface QuickAction {
  href: string;
  title: string;
  description: string;
}

export interface DashboardData {
  userProfile: UserProfile;
  latestEntry: DashboardEntry | null;
  journalEntries: DashboardEntry[];
  moodTrend: TrendPoint[];
  riskTrend: TrendPoint[];
  weeklyDigest: string[];
  quickActions: QuickAction[];
  analysisInsights?: DashboardInsights;
}

export type DashboardEntry = Pick<JournalEntry, "id" | "title" | "mood" | "emotions" | "tags" | "createdAt"> & Partial<JournalEntry>;
