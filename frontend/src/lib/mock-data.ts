import type { ChatMessage, Clinic, Hotline, JournalEntry, Provider, QuickAction, TrendPoint } from "@/types";

export const userProfile = {
  name: "Mira",
  timezone: "Asia/Manila",
  streakDays: 12,
  privacyStatus: "Private by default",
  nextCheckIn: "Tonight at 8:30 PM",
};

export const moodTrend: TrendPoint[] = [
  { label: "Mon", value: 52, mood: "neutral" },
  { label: "Tue", value: 66, mood: "calm" },
  { label: "Wed", value: 44, mood: "anxious" },
  { label: "Thu", value: 62, mood: "happy" },
  { label: "Fri", value: 58, mood: "calm" },
  { label: "Sat", value: 74, mood: "happy" },
  { label: "Sun", value: 61, mood: "calm" },
];

export const riskTrend: TrendPoint[] = [
  { label: "Mon", value: 24, band: "low" },
  { label: "Tue", value: 28, band: "mild" },
  { label: "Wed", value: 41, band: "moderate" },
  { label: "Thu", value: 33, band: "mild" },
  { label: "Fri", value: 27, band: "low" },
  { label: "Sat", value: 22, band: "low" },
  { label: "Sun", value: 25, band: "low" },
];

export const facialTrend: TrendPoint[] = [
  { label: "Mon", value: 48 },
  { label: "Tue", value: 56 },
  { label: "Wed", value: 43 },
  { label: "Thu", value: 61 },
  { label: "Fri", value: 59 },
  { label: "Sat", value: 64 },
  { label: "Sun", value: 60 },
];

export const emotionWheel = [
  { label: "Calm", value: 30, mood: "calm" as const },
  { label: "Hopeful", value: 18, mood: "happy" as const },
  { label: "Tired", value: 16, mood: "neutral" as const },
  { label: "Worried", value: 14, mood: "anxious" as const },
  { label: "Sad", value: 12, mood: "sad" as const },
  { label: "Irritated", value: 10, mood: "angry" as const },
];

export const journalEntries: JournalEntry[] = [
  {
    id: "evening-window",
    title: "A slower evening by the window",
    date: "Today, 8:42 PM",
    excerpt: "The walk helped me reset. I noticed my shoulders soften after a few minutes outside.",
    body:
      "I took the long route home and let the evening be quiet. The air felt warm, and I did not rush dinner. I still had a few worried thoughts, but they moved through faster when I wrote them down.",
    mood: "calm",
    riskBand: "low",
    riskScore: 24,
    emotions: ["calm", "tired", "relieved"],
    tags: ["walk", "evening", "sleep"],
    summary: "Lower distress signals with steady language and more future-oriented phrasing.",
    perspective:
      "ECHO noticed that naming the walk, dinner, and writing created a clear chain of support. That is a pattern worth keeping close.",
    trend: [
      { label: "Start", value: 46 },
      { label: "Middle", value: 32 },
      { label: "End", value: 24 },
    ],
  },
  {
    id: "meeting-aftercare",
    title: "After the meeting",
    date: "Yesterday, 6:10 PM",
    excerpt: "I felt tense at first, then clearer after I sent the follow-up and closed my laptop.",
    body:
      "The meeting pulled me into old habits of over-explaining. I paused before replying and wrote a shorter follow-up. That felt like choosing steadiness instead of panic.",
    mood: "neutral",
    riskBand: "mild",
    riskScore: 31,
    emotions: ["tense", "clear", "proud"],
    tags: ["work", "boundaries"],
    summary: "Mild distress signals tied to work pressure, followed by helpful self-regulation.",
    perspective:
      "You created a pause between the stress and the response. That pause is a real coping skill, not a small detail.",
    trend: [
      { label: "Start", value: 58 },
      { label: "Middle", value: 44 },
      { label: "End", value: 31 },
    ],
  },
  {
    id: "morning-static",
    title: "Morning static",
    date: "Monday, 9:05 AM",
    excerpt: "My thoughts were loud before breakfast. A five-minute grounding session helped.",
    body:
      "I woke up with a knot in my chest and kept checking messages. The 5-4-3-2-1 grounding made the room feel less far away.",
    mood: "anxious",
    riskBand: "moderate",
    riskScore: 42,
    emotions: ["worried", "alert", "settled"],
    tags: ["morning", "grounding"],
    summary: "Moderate distress signal, with recovery language after grounding.",
    perspective:
      "ECHO is not diagnosing this pattern. It is highlighting that grounding seemed to reduce intensity during this entry.",
    trend: [
      { label: "Start", value: 68 },
      { label: "Middle", value: 52 },
      { label: "End", value: 42 },
    ],
  },
];

export const quickActions: QuickAction[] = [
  { title: "Write a journal entry", description: "Capture a few sentences privately.", href: "/journal/new" },
  { title: "Talk with Buddy", description: "Use a reflective prompt or grounding cue.", href: "/buddy" },
  { title: "Start grounding", description: "Try a short paced breathing session.", href: "/tools/grounding" },
  { title: "Find support", description: "Search providers and crisis resources.", href: "/support/find-help" },
];

export const buddyMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "buddy",
    content: "I am here with you. Want to name one thing that feels most present right now?",
    timestamp: "8:18 PM",
  },
  {
    id: "m2",
    role: "user",
    content: "My chest feels tight, but I am safe at home.",
    timestamp: "8:19 PM",
  },
  {
    id: "m3",
    role: "buddy",
    content:
      "Thank you for saying the safety part clearly. Let us keep this practical: place both feet down and describe three things you can see.",
    timestamp: "8:20 PM",
  },
];

export const promptChips = [
  "Help me untangle a thought",
  "Guide a two-minute grounding",
  "Reflect on today",
  "Plan a gentle next step",
];

export const providers: Provider[] = [
  {
    name: "Avery Chen, LMFT",
    specialty: "Anxiety, life transitions",
    distance: "1.8 mi",
    availability: "Openings this week",
    imageKey: "therapistPortrait",
    tags: ["Telehealth", "Evenings"],
  },
  {
    name: "Northside Counseling Room",
    specialty: "Individual therapy and support groups",
    distance: "3.4 mi",
    availability: "Next consult Friday",
    imageKey: "therapyOfficePlants",
    tags: ["In person", "Sliding scale"],
  },
  {
    name: "Warmline Wellness Center",
    specialty: "Short-term counseling",
    distance: "5.2 mi",
    availability: "Same-day intake",
    imageKey: "counselingRoomWarm",
    tags: ["Crisis planning", "Groups"],
  },
];

export const hotlines: Hotline[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    action: "Call or text 988",
    description: "Free, confidential support in the United States.",
  },
  {
    name: "Crisis Text Line",
    action: "Text HOME to 741741",
    description: "Text-based crisis support from trained volunteers.",
  },
  {
    name: "Emergency services",
    action: "Call 911",
    description: "Use emergency services if you or someone else is in immediate danger.",
  },
];

export const clinics: Clinic[] = [
  { name: "Riverside Community Clinic", location: "Downtown", hours: "Mon-Fri, 8 AM-6 PM" },
  { name: "Harbor Behavioral Health", location: "Westside", hours: "Daily crisis intake" },
  { name: "Open Door Family Services", location: "North district", hours: "Tue-Sat, 9 AM-5 PM" },
];

export const weeklyDigest = [
  "Evening entries show the strongest calming pattern.",
  "Grounding appeared in two lower-risk reflections.",
  "Work pressure was the most repeated stress context.",
];
