import type { DashboardService } from "./dashboard.service";
import { successResult } from "@/shared/services/service-result";
import type { DashboardData } from "../model/dashboard.model";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createDashboardMockAdapter(): DashboardService {
  return {
    async getDashboardData() {
      await delay(300 + Math.random() * 300);

      const data: DashboardData = {
        userProfile: {
          name: "Mira",
          streakDays: 14,
          nextCheckIn: "8:00 PM",
          privacyStatus: "Private",
        },
        latestEntry: {
          id: "morning-static",
          title: "Morning static",
          body: "Woke up feeling heavy. The sky was grey...",
          excerpt: "Woke up feeling heavy.",
          mood: "anxious",
          emotions: ["overwhelmed", "worried"],
          tags: ["morning", "anxiety"],
          privacyStatus: "private",
          analysisConsent: true,
          riskScore: 41,
          riskBand: "moderate",
          summary: "Anxious morning with persistent worries.",
          perspective: null,
          createdAt: "2026-07-10",
          updatedAt: "2026-07-10",
        },
        journalEntries: [
          {
            id: "morning-static",
            title: "Morning static",
            body: "Woke up feeling heavy...",
            excerpt: "Woke up feeling heavy.",
            mood: "anxious",
            emotions: ["overwhelmed", "worried"],
            tags: ["morning", "anxiety"],
            privacyStatus: "private",
            analysisConsent: true,
            riskScore: 41,
            riskBand: "moderate",
            summary: "Anxious morning.",
            perspective: null,
            createdAt: "2026-07-10",
            updatedAt: "2026-07-10",
          },
          {
            id: "meeting-aftercare",
            title: "Meeting aftercare",
            body: "Had a difficult meeting today...",
            excerpt: "Had a difficult meeting.",
            mood: "sad",
            emotions: ["frustrated", "regretful"],
            tags: ["work", "meeting"],
            privacyStatus: "private",
            analysisConsent: true,
            riskScore: 35,
            riskBand: "moderate",
            summary: "Difficult meeting aftermath.",
            perspective: null,
            createdAt: "2026-07-09",
            updatedAt: "2026-07-09",
          },
          {
            id: "evening-window",
            title: "Evening window",
            body: "The evening light came through...",
            excerpt: "The evening light.",
            mood: "calm",
            emotions: ["peaceful", "hopeful"],
            tags: ["evening", "reflection"],
            privacyStatus: "private",
            analysisConsent: true,
            riskScore: 12,
            riskBand: "low",
            summary: "Calm evening reflection.",
            perspective: null,
            createdAt: "2026-07-08",
            updatedAt: "2026-07-08",
          },
        ],
        moodTrend: [
          { label: "Mon", value: 65 },
          { label: "Tue", value: 42 },
          { label: "Wed", value: 78 },
          { label: "Thu", value: 55 },
          { label: "Fri", value: 88 },
          { label: "Sat", value: 70 },
          { label: "Sun", value: 60 },
        ],
        riskTrend: [
          { label: "Mon", value: 30 },
          { label: "Tue", value: 45 },
          { label: "Wed", value: 25 },
          { label: "Thu", value: 50 },
          { label: "Fri", value: 20 },
          { label: "Sat", value: 35 },
          { label: "Sun", value: 41 },
        ],
        weeklyDigest: [
          "You reflected most in the morning this week.",
          "Anxiety appeared in 3 of your 7 entries.",
          "You used grounding language more toward the weekend.",
          "Your calmest moments followed evening entries.",
        ],
        quickActions: [
          { href: "/journal/new", title: "Write a reflection", description: "Private journal entry" },
          { href: "/buddy", title: "Talk with Buddy", description: "Gentle check-in conversation" },
          { href: "/tools/grounding", title: "Grounding exercise", description: "Breathing or sensory" },
          { href: "/insights/emotion", title: "Review patterns", description: "Mood and risk trends" },
        ],
      };

      return successResult(data);
    },
  };
}
