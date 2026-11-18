/*!
 * Voice orb by UV · https://github.com/imuvrays1/voice-orb
 * Copyright (c) 2026 UV · MIT License (see LICENSE). Keep this notice in copies.
 */

/**
 * The voice orb's palettes, types and states, and the copy of the page that
 * shows them at /.
 *
 * Each palette is four stops, deep to light, plus a glint: a neighbouring hue
 * the shader only lets in at the brightest points, which is what keeps a
 * one-hue orb from reading flat. A stop is a hex, or a custom property name
 * the renderer resolves off :root (so a token change would land here too).
 * The palettes here are plain hex, so they don't depend on the page's theme.
 */

export type OrbVariant = "painted" | "glass" | "silk" | "halftone";

export type OrbState =
  | "dormant"
  | "ready"
  | "connecting"
  | "listening"
  | "talking"
  | "settled";

export type OrbPaletteId = "twilight" | "sunset" | "lagoon" | "forest" | "midnight";

/** deep, mid, light, glint. */
export type OrbStops = [string, string, string, string];

export interface OrbPalette {
  id: OrbPaletteId;
  name: string;
  /** A short description of the ramp, shown under the orb. */
  scenario: string;
  stops: OrbStops;
  note: string;
}

export const ORB_PALETTES: OrbPalette[] = [
  {
    id: "twilight",
    name: "Twilight",
    scenario: "Violet to orchid",
    stops: ["#4a3aff", "#8a7fff", "#d2cfff", "#f6c9ff"],
    note: "Violet shadows, a lavender body and an orchid glint.",
  },
  {
    id: "sunset",
    name: "Sunset",
    scenario: "Plum to gold",
    stops: ["#55206e", "#e8566c", "#ffab73", "#ffe6a6"],
    note: "Plum shadows, a coral body and a gold glint.",
  },
  {
    id: "lagoon",
    name: "Lagoon",
    scenario: "Navy to aqua",
    stops: ["#003f86", "#018dff", "#8fd2ff", "#c4fff1"],
    note: "Navy shadows, a sky blue body and an aqua glint.",
  },
  {
    id: "forest",
    name: "Forest",
    scenario: "Pine to sunlight",
    stops: ["#0b5134", "#1da463", "#93e2b6", "#fff0b8"],
    note: "Pine to mint, with a glint of sunlight.",
  },
  {
    id: "midnight",
    name: "Midnight",
    scenario: "Indigo to white",
    stops: ["#080064", "#4a3aff", "#bfbaff", "#ffffff"],
    note: "Indigo to violet with a white glint: the neutral orb.",
  },
];

export interface OrbParams {
  speed: number;
  warp: number;
  sphere: number;
  detail: number;
  grain: number;
  pulse: number;
  highlight: number;
  exposure: number;
  saturation: number;
  /** How far the voice's liquid carries the colour (fluid.ts); 0 turns it off. */
  fluid: number;
}

export const ORB_PARAM_DEFAULTS: OrbParams = {
  speed: 1,
  warp: 0.8,
  sphere: 0.85,
  detail: 1.1,
  grain: 0.22,
  pulse: 0.6,
  highlight: 0.7,
  exposure: 0,
  saturation: 1,
  fluid: 0.7,
};
