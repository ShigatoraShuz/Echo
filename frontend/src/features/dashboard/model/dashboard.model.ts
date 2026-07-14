import type { JournalEntry } from "@/features/journal/model/journal.model";

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
  latestEntry: JournalEntry | null;
  journalEntries: JournalEntry[];
  moodTrend: TrendPoint[];
  riskTrend: TrendPoint[];
  weeklyDigest: string[];
  quickActions: QuickAction[];
}
