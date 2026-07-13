// ─── Centralized Unsplash image catalog ──────────────
// All image metadata lives here. No raw Unsplash URLs appear in pages.
// Uses next/image with stable dimensions and responsive sizes.

export interface EchoImageAsset {
  key: string;
  category: string;
  src: string;
  alt: string;
  credit: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
}

export const echoImages = {
  calmChairPlant: {
    key: "calmChairPlant",
    category: "calm chair plant interior natural light",
    src: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1400&q=80",
    alt: "Calm interior with soft chairs, plants, and natural window light.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 50vw, 100vw",
  },
  cozyChairWindow: {
    key: "cozyChairWindow",
    category: "cozy chair plant window",
    src: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1400&q=80",
    alt: "Cozy chair near a window with warm daylight and nearby plants.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 50vw, 100vw",
  },
  plantDeskWarmLight: {
    key: "plantDeskWarmLight",
    category: "plant desk warm light",
    src: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1400&q=80",
    alt: "Warm desk setup with plants and soft daylight.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
  wellnessInteriorPlantsChair: {
    key: "wellnessInteriorPlantsChair",
    category: "wellness interior plants chair",
    src: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=80",
    alt: "Wellness office interior with plants and comfortable seating.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 50vw, 100vw",
  },
  meditationRoomPlant: {
    key: "meditationRoomPlant",
    category: "meditation room plant natural light",
    src: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=80",
    alt: "Quiet meditation setting with plants and natural light.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
  therapyOfficePlants: {
    key: "therapyOfficePlants",
    category: "therapy office plants",
    src: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=80",
    alt: "Professional office space arranged for private conversation.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
  counselingRoomWarm: {
    key: "counselingRoomWarm",
    category: "counseling room warm",
    src: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=80",
    alt: "Warm counseling room with seats arranged for supportive conversation.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
  therapistPortrait: {
    key: "therapistPortrait",
    category: "professional therapist portrait",
    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1400&q=80",
    alt: "Professional therapist portrait in a calm indoor setting.",
    credit: "Unsplash",
    width: 1400,
    height: 1050,
    sizes: "(min-width: 1024px) 33vw, 100vw",
  },
} satisfies Record<string, EchoImageAsset>;

export type EchoImageKey = keyof typeof echoImages;

export function getEchoImage(key: EchoImageKey) {
  return echoImages[key];
}
