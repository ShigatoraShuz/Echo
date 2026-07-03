import type { EchoMood, EchoRiskBand } from "@/lib/theme";

export type EchoImageAsset = {
  key: string;
  category: string;
  src: string;
  alt: string;
  credit: string;
};

export type TrendPoint = {
  label: string;
  value: number;
  secondary?: number;
  mood?: EchoMood;
  band?: EchoRiskBand;
};

export type JournalEntry = {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  body: string;
  mood: EchoMood;
  riskBand: EchoRiskBand;
  riskScore: number;
  emotions: string[];
  tags: string[];
  summary: string;
  perspective: string;
  trend: TrendPoint[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "buddy";
  content: string;
  timestamp: string;
};

export type Provider = {
  name: string;
  specialty: string;
  distance: string;
  availability: string;
  imageKey: string;
  tags: string[];
};

export type Hotline = {
  name: string;
  action: string;
  description: string;
};

export type Clinic = {
  name: string;
  location: string;
  hours: string;
};

export type QuickAction = {
  title: string;
  description: string;
  href: string;
};
