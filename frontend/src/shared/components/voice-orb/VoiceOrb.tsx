/*!
 * Voice orb by UV · https://github.com/imuvrays1/voice-orb
 * Copyright (c) 2026 UV · MIT License (see LICENSE). Keep this notice in copies.
 */

"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ORB_PALETTES,
  ORB_PARAM_DEFAULTS,
  type OrbPaletteId,
  type OrbParams,
  type OrbState,
  type OrbStops,
  type OrbVariant,
} from "./orb-data";
import type { Bands, LevelSource } from "./audio";
import { cssColor, getOrbRenderer, type OrbFrame, type OrbView } from "./renderer";
import styles from "./VoiceOrb.module.css";

/** What the orb is doing this frame, for meters. */
export interface OrbMeter {
  bands: Bands;
  level: number;
  input: number;
}

interface VoiceOrbProps {
  /** A palette, or four stops of your own (deep, mid, light, glint). */
  palette: OrbPaletteId | OrbStops;
  variant?: OrbVariant;
  state?: OrbState;
  /** The agent's voice. Read while talking. */
  voice?: LevelSource | null;
  /** The caller's voice. Read while listening. */
  caller?: LevelSource | null;
  params?: Partial<OrbParams>;
  /** Moves the field's pattern; defaults to one per palette. */
  seed?: number;
  /** Any CSS length; the orb is square. */
  size?: string;
  className?: string;
  /** Names the orb for assistive tech. Without it the orb is decorative. */
  label?: string;
  /** Called with the levels every drawn frame (the board's meters). */
  onFrame?: (meter: OrbMeter) => void;
  /**
   * A painted image of a ball to move instead of the procedural field (the
   * artwork shader). The image must be same-origin or served with CORS.
   */
  artwork?: string;
}

/*
 * Each state is a set of targets the orb eases toward, so a change of state
 * is a transition, never a cut:
 *   speed   how fast the field drifts (0 holds it still)
 *   think   the connecting wander and the circling highlight
 *   dim     drains colour (dormant, settled)
 *   scale   the ball's size in its frame
 *   voice / caller  which level source drives it
 */
const TARGETS: Record<
  OrbState,
  { speed: number; think: number; dim: number; scale: number; voice: boolean; caller: boolean }
> = {
  dormant: { speed: 0, think: 0, dim: 1, scale: 0.9, voice: false, caller: false },
  ready: { speed: 1, think: 0, dim: 0, scale: 0.96, voice: false, caller: false },
  connecting: { speed: 2.2, think: 1, dim: 0, scale: 0.94, voice: false, caller: false },
  // Listening drifts a little faster than ready, so it reads as attentive.
  listening: { speed: 1.3, think: 0, dim: 0, scale: 0.96, voice: false, caller: true },
  // Talking sits a little smaller so the voice has room to breathe it out
  // to the edge, and drifts well over twice as fast once the voice arrives.
  talking: { speed: 2.4, think: 0, dim: 0, scale: 0.94, voice: true, caller: false },
  settled: { speed: 0.45, think: 0, dim: 0.35, scale: 0.94, voice: false, caller: false },
};

const EASE = 4;
const SETTLED = 0.002;

/*
 * How a talking orb starts, so pressing Play reads as a sequence rather than
 * a cut: whatever zooms the orb (the page, with CSS) starts at once; the
 * drift speeds up after SPEED_AFTER seconds; the voice's pulse then fades in
 * between PULSE_FROM and PULSE_TO. Leaving talking eases everything back.
 */
const SPEED_AFTER = 0.25;
const PULSE_FROM = 0.45;
const PULSE_TO = 1.1;
/* The idle drift: how far the colour field moves per second at speed 1.
   Enough that a resting orb is plainly moving at a glance, slow enough to
   stay calm. (0.28 read as still to people who weren't looking for it.) */
const DRIFT_RATE = 0.42;
/* How much the voice's level grows the ball while talking: the breathing. */
const BREATH = 0.05;
/* While listening, the caller's bands move the inside too, a little softer
   than a talking voice, and pull the liquid inward instead of pushing out. */
const LISTEN_GAIN = 0.8;
/* The heard levels follow the audio quickly up and let go more slowly
   (per second), so the inside moves smoothly instead of flickering. */
const ATTACK = 24;
const RELEASE = 7;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function seedFor(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * The voice orb: a shader ball in a palette, moving with a voice.
 *
 * Six states (see TARGETS and ORB_STATES in data/orb.ts) and four types
 * (shaders.ts). Talking reads `voice` every frame, listening reads `caller`;
 * either can be a recording, the microphone, a voice SDK's analyser in a call,
 * or a simulated voice (lib/orb/audio.ts). Every orb on a page draws through
 * one shared WebGL context (lib/orb/renderer.ts) and only while on screen.
 *
 * Without WebGL2 it shows a still CSS gradient in the same palette.
 */
export default function VoiceOrb({
  palette,
  variant = "painted",
  state = "ready",
  voice = null,
  caller = null,
  params,
  seed,
  size = "240px",
  className,
  label,
  onFrame,
  artwork,
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<OrbView | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [fallback, setFallback] = useState(false);

  const stops: OrbStops = useMemo(() => {
    if (Array.isArray(palette)) return palette as OrbStops;
    return (ORB_PALETTES.find((p) => p.id === palette) ?? ORB_PALETTES[0]).stops;
  }, [palette]);
  const resolvedSeed = seed ?? seedFor(Array.isArray(palette) ? palette.join() : palette);

  // The latest props, read by the render loop without restarting it.
  const props = useRef({ variant, state, voice, caller, stops, params, seed: resolvedSeed, onFrame });
  props.current = { variant, state, voice, caller, stops, params, seed: resolvedSeed, onFrame };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = getOrbRenderer();
    if (!renderer) {
      setFallback(true);
      return;
    }

    const start = TARGETS[props.current.state];
    const cur = {
      time: 0,
      drift: resolvedSeed * 40,
      pulse: 0,
      speed: start.speed,
      think: start.think,
      dim: start.dim,
      scale: start.scale,
      bands: [0, 0, 0, 0] as Bands,
      level: 0,
      input: 0,
      /** Seconds since talking began, for the start sequence. */
      talk: 0,
    };

    const view: OrbView = {
      canvas,
      visible: false,
      dirty: true,
      live() {
        const p = props.current;
        const t = TARGETS[p.state];
        if (t.speed > 0) return true;
        // A still state is only live while easing into it.
        return (
          Math.abs(cur.speed - t.speed) > SETTLED ||
          Math.abs(cur.dim - t.dim) > SETTLED ||
          Math.abs(cur.scale - t.scale) > SETTLED ||
          cur.level > SETTLED ||
          cur.input > SETTLED
        );
      },
      frame(dt): OrbFrame {
        const p = props.current;
        const t = TARGETS[p.state];
        const k = 1 - Math.exp(-dt * EASE);
        const talking = t.voice && Boolean(p.voice);
        cur.talk = talking ? cur.talk + dt : 0;
        // Hold the drift where it is for a moment after Play, then speed up.
        const speedTarget = talking && cur.talk < SPEED_AFTER ? cur.speed : t.speed;
        cur.speed += (speedTarget - cur.speed) * k;
        cur.think += (t.think - cur.think) * k;
        cur.dim += (t.dim - cur.dim) * k;

        // The voice and the caller: read only in the states that use them,
        // and let go of gently otherwise.
        const listening = t.caller && Boolean(p.caller);
        const heard = talking ? p.voice!.read(dt) : null;
        const said = listening ? p.caller!.read(dt) : null;
        // The pulse fades in after the zoom and the speed-up.
        const gain = smoothstep(PULSE_FROM, PULSE_TO, cur.talk);
        const up = 1 - Math.exp(-dt * ATTACK);
        const down = 1 - Math.exp(-dt * RELEASE);
        const follow = (from: number, to: number) => from + (to - from) * (to > from ? up : down);
        // The bands move the inside (rings, highlight, liquid): the agent's
        // voice while talking, the caller's while listening.
        for (let i = 0; i < 4; i++) {
          const target = heard ? heard.bands[i] * gain : said ? said.bands[i] * LISTEN_GAIN : 0;
          cur.bands[i] = follow(cur.bands[i], target);
        }
        cur.level = follow(cur.level, heard ? heard.level * gain : 0);
        cur.input = follow(cur.input, said ? said.level : 0);

        const params = { ...ORB_PARAM_DEFAULTS, ...p.params };
        // The drift clock: time scaled by state, plus the voice's level, so
        // speech speeds the field up and silence lets it coast without a jump.
        cur.time += dt;
        cur.drift += dt * params.speed * (DRIFT_RATE * cur.speed + 0.9 * cur.level + 0.6 * cur.input);
        cur.pulse += dt * (0.22 * cur.speed + 1.6 * cur.bands[1]);
        const breathe = Math.sin(cur.time * 2.4) * 0.012 * cur.think;
        const targetScale = t.scale - cur.input * 0.06 + cur.level * (t.voice ? BREATH : 0.025) + breathe;
        cur.scale += (targetScale - cur.scale) * (1 - Math.exp(-dt * 9));

        p.onFrame?.({ bands: [...cur.bands] as Bands, level: cur.level, input: cur.input });

        return {
          variant: imageRef.current ? "artwork" : p.variant,
          image: imageRef.current,
          stops: p.stops,
          params,
          seed: p.seed,
          time: cur.time,
          drift: cur.drift,
          pulse: cur.pulse,
          bands: cur.bands,
          level: cur.level,
          input: cur.input,
          pull: listening,
          think: cur.think,
          scale: cur.scale,
          dim: cur.dim,
        };
      },
    };
    viewRef.current = view;

    // Buffer at the display's pixels, capped at 2x.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * density));
      const h = Math.max(1, Math.round(rect.height * density));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        view.dirty = true;
        renderer.wake();
      }
    };
    resize();
    const sizer = new ResizeObserver(resize);
    sizer.observe(canvas);

    const watcher = new IntersectionObserver(([entry]) => {
      view.visible = entry.isIntersecting;
      if (view.visible) renderer.wake();
    });
    watcher.observe(canvas);

    renderer.register(view);
    return () => {
      sizer.disconnect();
      watcher.disconnect();
      renderer.unregister(view);
      viewRef.current = null;
    };
    // The view reads props through the ref; it is built once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The artwork, loaded with CORS so WebGL may read it; the orb redraws once
  // it has arrived.
  useEffect(() => {
    if (!artwork) {
      imageRef.current = null;
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      const view = viewRef.current;
      if (view) view.dirty = true;
      getOrbRenderer()?.wake();
    };
    image.src = artwork;
    imageRef.current = image;
    return () => {
      image.onload = null;
    };
  }, [artwork]);

  // A changed prop needs at least one frame, even for a still orb.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dirty = true;
    getOrbRenderer()?.wake();
  }, [variant, state, stops, params, resolvedSeed, voice, caller]);

  const style = {
    "--orb-size": size,
    "--orb-0": cssColor(stops[0]),
    "--orb-1": cssColor(stops[1]),
    "--orb-2": cssColor(stops[2]),
    ...(artwork ? { "--orb-art": `url("${artwork}")` } : {}),
  } as CSSProperties;

  return (
    <div
      className={`${styles.orb} ${fallback ? styles.fallback : ""} ${className ?? ""}`.trim()}
      style={style}
      data-state={state}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
