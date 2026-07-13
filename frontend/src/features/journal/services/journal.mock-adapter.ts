import type {
  JournalEntry,
  JournalDraft,
  JournalAnalysis,
  JournalMood,
  JournalRiskBand,
} from "../model/journal.model";
import type { JournalService } from "./journal.service";

// ─── In-memory store ─────────────────────────────────

let nextId = 100;
const entries: JournalEntry[] = [
  {
    id: "morning-static",
    title: "Morning static",
    body: "Woke up feeling heavy. The sky was grey and I could hear the rain outside. I made coffee and sat by the window for a while. My mind kept circling back to the same worries about work and family. I tried to focus on my breathing for a few minutes. It helped a little, but the weight is still there. I think I need to talk to someone about this soon.",
    excerpt: "Woke up feeling heavy. The sky was grey and I could hear the rain outside...",
    mood: "anxious",
    emotions: ["overwhelmed", "worried"],
    tags: ["morning", "anxiety", "rain"],
    privacyStatus: "private",
    analysisConsent: true,
    riskScore: 41,
    riskBand: "moderate",
    summary: "Anxious morning with persistent worries.",
    perspective: "Morning anxiety often feels heavier than it becomes later. Notice how you already took steps: making coffee, sitting by the window, focusing on your breath. Those are real coping actions.",
    createdAt: "2026-07-10",
    updatedAt: "2026-07-10",
  },
  {
    id: "meeting-aftercare",
    title: "Meeting aftercare",
    body: "Had a difficult meeting today. I felt defensive and spoke too quickly. Afterward, I took a short walk around the block to reset. I noticed the air felt cooler and the breeze helped me slow down. I wish I had handled the conversation better, but I'm trying not to dwell on it too much.",
    excerpt: "Had a difficult meeting today. I felt defensive and spoke too quickly...",
    mood: "sad",
    emotions: ["frustrated", "regretful"],
    tags: ["work", "meeting", "walk"],
    privacyStatus: "private",
    analysisConsent: true,
    riskScore: 33,
    riskBand: "mild",
    summary: "Post-meeting frustration with self-compassion attempt.",
    perspective: "Noticing the need to reset after a hard conversation shows self-awareness. The walk was a healthy choice. Consider what you might say differently next time — not as criticism, but as preparation.",
    createdAt: "2026-07-11",
    updatedAt: "2026-07-11",
  },
  {
    id: "evening-window",
    title: "Evening window",
    body: "The evening light came through the window and I felt a moment of calm. I sat with a cup of tea and watched the sky change color. I thought about what I was grateful for today: a kind message from a friend, a good lunch, the sound of rain earlier. It was a quiet ending to an otherwise busy day.",
    excerpt: "The evening light came through the window and I felt a moment of calm...",
    mood: "calm",
    emotions: ["grateful", "peaceful"],
    tags: ["evening", "calm", "gratitude"],
    privacyStatus: "private",
    analysisConsent: true,
    riskScore: 12,
    riskBand: "low",
    summary: "Calm evening with gratitude reflection.",
    perspective: "This entry shows a pattern of finding calm in small moments. The transition from a busy day to intentional quiet is a skill worth protecting.",
    createdAt: "2026-07-12",
    updatedAt: "2026-07-12",
  },
];

let drafts: JournalDraft[] = [];

const moodEmotionMap: Record<JournalMood, string[]> = {
  calm: ["peaceful", "content", "rested"],
  happy: ["grateful", "joyful", "hopeful"],
  neutral: ["reflective", "quiet", "present"],
  sad: ["heavy", "lonely", "tired"],
  anxious: ["worried", "overwhelmed", "restless"],
  angry: ["frustrated", "irritated", "defensive"],
};

function generateExcerpt(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  return cleaned.length > 120 ? cleaned.slice(0, 120).trimEnd() + "..." : cleaned;
}

function calculateRiskScore(mood: JournalMood): number {
  const scores: Record<JournalMood, number> = {
    calm: 10,
    happy: 8,
    neutral: 15,
    sad: 35,
    anxious: 40,
    angry: 45,
  };
  return Math.max(0, Math.min(100, scores[mood] + Math.round((Math.random() - 0.5) * 16)));
}

function calculateRiskBand(score: number): JournalRiskBand {
  if (score <= 15) return "low";
  if (score <= 30) return "mild";
  if (score <= 45) return "moderate";
  if (score <= 65) return "high";
  return "severe";
}

function generatePerspective(mood: JournalMood): string {
  const perspectives: Record<JournalMood, string> = {
    calm: "Moments of calm are worth noticing. They show that rest and safety are possible, even in small doses.",
    happy: "Noticing what brings warmth helps build a map of what matters to you. Hold onto these moments.",
    neutral: "Neutral days are not empty. They are the foundation that makes processing harder days possible.",
    sad: "Sadness is a signal, not a failure. You are allowed to feel it without needing to fix it immediately.",
    anxious: "Anxiety can make the present feel urgent. Returning to one slow breath is a meaningful step.",
    angry: "Anger often points to a boundary worth examining. What mattered enough to provoke this feeling?",
  };
  return perspectives[mood];
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Mock Adapter ─────────────────────────────────────

export function createJournalMockAdapter(): JournalService {
  const service: JournalService = {
    async listEntries(filters, page, pageSize, signal) {
      await delay(200 + Math.random() * 200);
      if (signal?.aborted) return { success: false, error: { code: "NETWORK", message: "Request was cancelled" } };

      let filtered = [...entries];

      if (filters.query) {
        const q = filters.query.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.body.toLowerCase().includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      if (filters.mood) {
        filtered = filtered.filter((e) => e.mood === filters.mood);
      }

      if (filters.dateFrom) {
        filtered = filtered.filter((e) => e.createdAt >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        filtered = filtered.filter((e) => e.createdAt <= filters.dateTo!);
      }

      switch (filters.sort) {
        case "newest": filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
        case "oldest": filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
        case "highest-risk": filtered.sort((a, b) => b.riskScore - a.riskScore); break;
        case "lowest-risk": filtered.sort((a, b) => a.riskScore - b.riskScore); break;
      }

      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);

      return {
        success: true,
        data: {
          entries: paged,
          pagination: { page: safePage, pageSize, totalItems, totalPages },
        },
      };
    },

    async getEntry(id) {
      await delay(100 + Math.random() * 100);
      const entry = entries.find((e) => e.id === id);
      if (!entry) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };
      return { success: true, data: entry };
    },

    async createEntry(input) {
      await delay(200 + Math.random() * 200);
      const id = `entry-${nextId++}`;
      const score = calculateRiskScore(input.mood);
      const now = new Date().toISOString().split("T")[0];
      const entry: JournalEntry = {
        id,
        title: input.title,
        body: input.body,
        excerpt: generateExcerpt(input.body),
        mood: input.mood,
        emotions: input.emotions.length > 0 ? input.emotions : moodEmotionMap[input.mood].slice(0, 2),
        tags: input.tags,
        privacyStatus: input.privacyStatus,
        analysisConsent: input.analysisConsent,
        riskScore: score,
        riskBand: calculateRiskBand(score),
        summary: `A ${input.mood} reflection on ${now}.`,
        perspective: null,
        createdAt: now,
        updatedAt: now,
      };
      entries.unshift(entry);

      if (input.analysisConsent) {
        service.requestAnalysis(id);
      }

      return { success: true, data: entry };
    },

    async updateEntry(id, input) {
      await delay(150 + Math.random() * 100);
      const idx = entries.findIndex((e) => e.id === id);
      if (idx === -1) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };

      const now = new Date().toISOString().split("T")[0];
      entries[idx] = {
        ...entries[idx],
        ...input,
        updatedAt: now,
      };
      return { success: true, data: entries[idx] };
    },

    async deleteEntry(id) {
      await delay(100);
      const idx = entries.findIndex((e) => e.id === id);
      if (idx === -1) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };
      entries.splice(idx, 1);
      return { success: true, data: undefined };
    },

    async saveDraft(draft) {
      await delay(50);
      const idx = drafts.findIndex((d) => d.id === draft.id);
      const now = new Date().toISOString().split("T")[0];
      const updated = { ...draft, updatedAt: now };
      if (idx >= 0) {
        drafts[idx] = updated;
      } else {
        drafts.push(updated);
      }
      return { success: true, data: updated };
    },

    async getDraft(id) {
      await delay(30);
      const draft = drafts.find((d) => d.id === id) || null;
      return { success: true, data: draft };
    },

    async deleteDraft(id) {
      await delay(30);
      drafts = drafts.filter((d) => d.id !== id);
      return { success: true, data: undefined };
    },

    async requestAnalysis(entryId) {
      await delay(300 + Math.random() * 400);
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };

      const analysis: JournalAnalysis = {
        id: `analysis-${entryId}`,
        entryId: entry.id,
        summary: entry.summary,
        perspective: generatePerspective(entry.mood),
        moodInsight: `Your mood trend shows a pattern of ${entry.mood} reflections.`,
        riskIndication: `Current risk signal is ${entry.riskBand}.`,
        isDemoData: true,
        createdAt: new Date().toISOString().split("T")[0],
      };

      return { success: true, data: analysis };
    },

    async getAnalysis(entryId) {
      await delay(50);
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };
      if (!entry.analysisConsent || !entry.perspective) {
        return { success: true, data: null };
      }
      const analysis: JournalAnalysis = {
        id: `analysis-${entryId}`,
        entryId: entry.id,
        summary: entry.summary,
        perspective: entry.perspective,
        moodInsight: `Your mood trend shows a pattern of ${entry.mood} reflections.`,
        riskIndication: `Current risk signal is ${entry.riskBand}.`,
        isDemoData: true,
        createdAt: entry.createdAt,
      };
      return { success: true, data: analysis };
    },

    async exportEntry(id) {
      await delay(100);
      const entry = entries.find((e) => e.id === id);
      if (!entry) return { success: false, error: { code: "NOT_FOUND", message: "Entry not found" } };

      const markdown = [
        `# ${entry.title}`,
        ``,
        `**Date:** ${entry.createdAt}`,
        `**Mood:** ${entry.mood}`,
        `**Privacy:** ${entry.privacyStatus}`,
        ``,
        entry.body,
        ``,
        entry.perspective ? `*ECHO perspective: ${entry.perspective}*` : "",
        ``,
        `---`,
        `*This is demonstration data. ECHO is not a diagnostic tool.*`,
      ]
        .filter(Boolean)
        .join("\n");

      return { success: true, data: { markdown } };
    },
  };

  return service;
}
