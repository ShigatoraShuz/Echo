/**
 * ECHO PDF Data Export Generator
 * Builds a clean, watermarked PDF report from journal entries, AI analyses,
 * mood distributions, and distress risk scores.
 *
 * Uses jsPDF for client-side PDF generation — no server round-trip required.
 */

import type { JournalEntry } from "@/features/journal/model/journal.model";
import type { ProfileSettings } from "@/features/settings/model/settings.model";

export interface PdfExportOptions {
  profile: ProfileSettings;
  entries: JournalEntry[];
  generatedAt?: Date;
}

// ─── Colour palette (aligns with ECHO theme tokens) ──────────────────────────
const PALETTE = {
  primary:   [83, 103, 51]  as const,  // #536733
  primaryBg: [245, 247, 240] as const, // light sage
  muted:     [120, 130, 110] as const,
  text:      [32,  40,  24]  as const,  // near-black sage
  white:     [255, 255, 255] as const,
  accent:    [160, 200, 120] as const,
  danger:    [188, 60,  60]  as const,
  warn:      [204, 140, 50]  as const,
  safe:      [70,  160, 90]  as const,
} as const;

function riskColor(band: string): readonly [number, number, number] {
  switch (band) {
    case "severe":   return PALETTE.danger;
    case "high":     return [200, 80, 60];
    case "moderate": return PALETTE.warn;
    case "mild":     return [180, 165, 60];
    default:         return PALETTE.safe;
  }
}

function moodEmoji(mood: string): string {
  const map: Record<string, string> = {
    calm:    "Calm",
    happy:   "Happy",
    neutral: "Neutral",
    sad:     "Sad",
    anxious: "Anxious",
    angry:   "Angry",
  };
  return map[mood] ?? mood;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year:    "numeric",
      month:   "long",
      day:     "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day:   "numeric",
      year:  "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Core Generator ───────────────────────────────────────────────────────────

export async function generateEchoPdfExport({
  profile,
  entries,
  generatedAt = new Date(),
}: PdfExportOptions): Promise<void> {
  // Dynamic import to keep bundle lean — only loaded on demand
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 20;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function newPageIfNeeded(requiredHeight = 20) {
    if (y + requiredHeight > PAGE_H - MARGIN) {
      addWatermark();
      doc.addPage();
      y = MARGIN;
    }
  }

  function setFont(
    style: "normal" | "bold" | "italic" = "normal",
    size = 10,
    color: readonly [number, number, number] = PALETTE.text,
  ) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  }

  function drawHRule(yPos: number, color: readonly [number, number, number] = PALETTE.primaryBg) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
  }

  function addWatermark() {
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.045 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.setTextColor(...PALETTE.primary);
    const wText = "ECHO";
    const wW = doc.getTextWidth(wText);
    doc.text(wText, (PAGE_W - wW) / 2, PAGE_H / 2 + 18, { angle: 45 });
    doc.restoreGraphicsState();
  }

  // ── Cover page ───────────────────────────────────────────────────────────

  // Header bar
  doc.setFillColor(...PALETTE.primary);
  doc.rect(0, 0, PAGE_W, 42, "F");

  // ECHO logotype
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...PALETTE.white);
  doc.text("ECHO", MARGIN, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(220, 230, 210);
  doc.text("Your Wellbeing Companion", MARGIN, 26);

  doc.setFontSize(8);
  doc.text("Confidential — For personal use only", MARGIN, 34);

  y = 58;

  setFont("bold", 20, PALETTE.primary);
  doc.text("Personal Wellbeing Report", MARGIN, y);
  y += 9;

  setFont("normal", 11, PALETTE.muted);
  doc.text(`${profile.displayName}`, MARGIN, y);
  y += 6;

  setFont("normal", 9, PALETTE.muted);
  doc.text(
    `Generated on ${formatDate(generatedAt.toISOString())}`,
    MARGIN,
    y,
  );
  y += 16;

  drawHRule(y);
  y += 10;

  // ── Summary statistics ───────────────────────────────────────────────────

  const totalEntries = entries.length;
  const moodCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.mood] = (acc[e.mood] ?? 0) + 1;
    return acc;
  }, {});
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const avgRisk =
    totalEntries > 0
      ? Math.round(entries.reduce((s, e) => s + e.riskScore, 0) / totalEntries)
      : 0;

  setFont("bold", 13, PALETTE.text);
  doc.text("Wellbeing at a Glance", MARGIN, y);
  y += 8;

  const stats = [
    { label: "Total Reflections", value: String(totalEntries) },
    { label: "Primary Mood", value: moodEmoji(topMood) },
    { label: "Avg. Distress Score", value: `${avgRisk} / 100` },
  ];

  const colW = CONTENT_W / 3;
  stats.forEach((stat, i) => {
    const x = MARGIN + i * colW;
    doc.setFillColor(...PALETTE.primaryBg);
    doc.roundedRect(x, y, colW - 4, 24, 3, 3, "F");

    setFont("bold", 16, PALETTE.primary);
    doc.text(stat.value, x + 6, y + 11);

    setFont("normal", 8, PALETTE.muted);
    doc.text(stat.label, x + 6, y + 19);
  });
  y += 34;

  // Mood breakdown bar chart (simple)
  setFont("bold", 11, PALETTE.text);
  doc.text("Mood Distribution", MARGIN, y);
  y += 6;

  const moods = Object.keys(moodCounts);
  moods.forEach((mood) => {
    newPageIfNeeded(10);
    const count = moodCounts[mood];
    const pct = totalEntries > 0 ? count / totalEntries : 0;
    const barW = CONTENT_W * 0.55 * pct;

    setFont("normal", 9, PALETTE.text);
    doc.text(capitalize(mood), MARGIN, y + 3.5);

    doc.setFillColor(...PALETTE.primaryBg);
    doc.roundedRect(MARGIN + 40, y - 1, CONTENT_W * 0.55, 6, 2, 2, "F");

    doc.setFillColor(...PALETTE.primary);
    if (barW > 0) doc.roundedRect(MARGIN + 40, y - 1, barW, 6, 2, 2, "F");

    setFont("normal", 8, PALETTE.muted);
    doc.text(`${count}`, MARGIN + 40 + CONTENT_W * 0.55 + 3, y + 3.5);

    y += 9;
  });

  y += 6;
  drawHRule(y);
  y += 10;

  // ── Journal entries ───────────────────────────────────────────────────────

  setFont("bold", 14, PALETTE.primary);
  doc.text("Journal Entries & AI Reflections", MARGIN, y);
  y += 10;

  if (entries.length === 0) {
    setFont("italic", 10, PALETTE.muted);
    doc.text("No journal entries found in your account.", MARGIN, y);
    y += 10;
  }

  entries.forEach((entry, idx) => {
    newPageIfNeeded(50);

    // Entry header band
    doc.setFillColor(...PALETTE.primaryBg);
    doc.roundedRect(MARGIN, y, CONTENT_W, 12, 3, 3, "F");

    setFont("bold", 11, PALETTE.text);
    const titleText = doc.splitTextToSize(
      `${idx + 1}. ${entry.title || "Untitled Reflection"}`,
      CONTENT_W - 50,
    );
    doc.text(titleText, MARGIN + 4, y + 8);

    // Date top-right
    setFont("normal", 8, PALETTE.muted);
    const dateStr = formatShortDate(entry.createdAt);
    const dateW = doc.getTextWidth(dateStr);
    doc.text(dateStr, MARGIN + CONTENT_W - dateW - 4, y + 8);

    y += 16;

    // Mood + risk badge
    const [rc0, rc1, rc2] = riskColor(entry.riskBand);
    doc.setFillColor(rc0, rc1, rc2);
    doc.roundedRect(MARGIN, y, 32, 7, 2, 2, "F");
    setFont("bold", 7.5, PALETTE.white);
    doc.text(entry.riskBand.toUpperCase(), MARGIN + 2.5, y + 4.8);

    doc.setFillColor(...PALETTE.primaryBg);
    doc.roundedRect(MARGIN + 35, y, 32, 7, 2, 2, "F");
    setFont("normal", 7.5, PALETTE.muted);
    doc.text(`Mood: ${capitalize(entry.mood)}`, MARGIN + 37, y + 4.8);

    if (entry.emotions.length > 0) {
      setFont("normal", 7.5, PALETTE.muted);
      doc.text(
        `Emotions: ${entry.emotions.slice(0, 4).join(", ")}`,
        MARGIN + 70,
        y + 4.8,
      );
    }

    y += 12;

    // Body excerpt
    if (entry.excerpt) {
      setFont("italic", 9, PALETTE.muted);
      const excerptLines = doc.splitTextToSize(`"${entry.excerpt}"`, CONTENT_W);
      newPageIfNeeded(excerptLines.length * 5 + 6);
      doc.text(excerptLines, MARGIN, y);
      y += excerptLines.length * 5 + 4;
    }

    // AI Perspective
    if (entry.perspective) {
      newPageIfNeeded(20);
      doc.setFillColor(232, 240, 224);
      const perspLines = doc.splitTextToSize(entry.perspective, CONTENT_W - 12);
      const perspH = perspLines.length * 4.8 + 8;
      doc.roundedRect(MARGIN, y, CONTENT_W, perspH, 3, 3, "F");

      setFont("bold", 8, PALETTE.primary);
      doc.text("ECHO AI Perspective", MARGIN + 5, y + 6);
      y += 8;

      setFont("normal", 8.5, PALETTE.text);
      doc.text(perspLines, MARGIN + 5, y);
      y += perspLines.length * 4.8 + 4;
    }

    // Risk score mini-bar
    setFont("normal", 8, PALETTE.muted);
    doc.text(`Distress score: ${entry.riskScore}/100`, MARGIN, y + 3.5);
    const barTotal = CONTENT_W * 0.35;
    doc.setFillColor(...PALETTE.primaryBg);
    doc.roundedRect(MARGIN + 38, y, barTotal, 5, 1.5, 1.5, "F");
    const [fr0, fr1, fr2] = riskColor(entry.riskBand);
    doc.setFillColor(fr0, fr1, fr2);
    const filled = barTotal * Math.min(1, entry.riskScore / 100);
    if (filled > 0) doc.roundedRect(MARGIN + 38, y, filled, 5, 1.5, 1.5, "F");

    y += 12;
    drawHRule(y, [220, 228, 210]);
    y += 8;
  });

  // ── Footer on last page ───────────────────────────────────────────────────

  addWatermark();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PALETTE.muted);
  const footer = `ECHO Wellbeing — Confidential personal export — ${formatShortDate(generatedAt.toISOString())}`;
  const fW = doc.getTextWidth(footer);
  doc.text(footer, (PAGE_W - fW) / 2, PAGE_H - 10);

  // ── Trigger download ──────────────────────────────────────────────────────

  const filename = `echo-wellbeing-report-${generatedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
