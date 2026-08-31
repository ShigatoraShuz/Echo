export const contrastRatios = {
  normalText: "4.5:1",
  largeText: "3:1",
  uiComponents: "3:1",
} as const;

export function meetsAA(foreground: string, background: string) {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  const ratio = getContrastRatio(fg, bg);
  return ratio >= 4.5;
}

function parseHex(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function getLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrastRatio(fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  const L1 = getLuminance(fg);
  const L2 = getLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
