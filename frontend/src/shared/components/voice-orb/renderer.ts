/*!
 * Voice orb by UV · https://github.com/imuvrays1/voice-orb
 * Copyright (c) 2026 UV · MIT License (see LICENSE). Keep this notice in copies.
 */

"use client";

import type { OrbParams, OrbStops } from "./orb-data";
import { Fluid, type FluidState } from "./fluid";
import { FRAGMENTS, VERTEX, type OrbShader } from "./shaders";

/**
 * One WebGL2 context for every voice orb on the page.
 *
 * Each orb is a view: a 2D canvas of its own plus a `frame()` that advances
 * its clocks and says what to draw. Per animation frame the renderer draws
 * each visible, moving view into the shared canvas at the view's size and
 * copies the result into the view's canvas. Browsers drop the oldest WebGL
 * context once a page holds about sixteen, so one context per orb would fail
 * on any page with a row of them; one shared context never does.
 *
 * What it takes care of:
 *  - Draws only views that are on screen (the view sets `visible`) and either
 *    moving (`live()`) or marked `dirty`. A dormant orb costs one frame.
 *  - Stops entirely in a hidden tab and when nothing is moving.
 *  - Reduced motion: every view gets one frame when it changes, nothing loops.
 *  - Context loss: views keep their last frame (it is in their own canvas),
 *    and everything is rebuilt and redrawn when the context comes back.
 *  - The fluid (fluid.ts): a view gets its own small liquid the first time
 *    its voice has bass, keeps it while mounted and stops stepping it once
 *    it has been quiet a while. A still frame (dt 0) never steps it.
 */

export interface OrbFrame {
  variant: OrbShader;
  /** The image the artwork shader samples; ignored by the other types. */
  image?: HTMLImageElement | null;
  stops: OrbStops;
  params: OrbParams;
  seed: number;
  time: number;
  drift: number;
  pulse: number;
  bands: [number, number, number, number];
  level: number;
  input: number;
  /** Listening: the bands are the caller's, and the liquid is pulled inward. */
  pull?: boolean;
  think: number;
  scale: number;
  dim: number;
}

export interface OrbView {
  canvas: HTMLCanvasElement;
  /** Advance by `dt` seconds (0 for a still) and return what to draw. */
  frame(dt: number): OrbFrame;
  /** Still changing: a state that loops, or easing toward a new one. */
  live(): boolean;
  visible: boolean;
  dirty: boolean;
}

type Program = {
  program: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
};

const UNIFORMS = [
  "uResolution", "uTime", "uDrift", "uPulse", "uBands", "uLevel", "uInput", "uThink",
  "uScale", "uDim", "uSeed", "uC0", "uC1", "uC2", "uC3", "uWarp", "uSphere", "uDetail",
  "uGrain", "uPulseAmt", "uHighlight", "uExposure", "uSaturation", "uImage",
  "uFlow", "uFlowVelocity", "uFlowAmt", "uFlowDebug",
] as const;

/**
 * Debug views of the fluid, from the address: ?flow draws every orb's
 * velocity instead of its colour, ?flow=grid a grid the liquid drags.
 */
const FLOW_DEBUG = (() => {
  if (typeof location === "undefined") return 0;
  const flow = new URLSearchParams(location.search).get("flow");
  return flow === null ? 0 : flow === "grid" ? 2 : 1;
})();

/* ---------- colour ---------- */

const colorCache = new Map<string, [number, number, number]>();

/** A hex, rgb() or a custom property name, to 0..1 components. */
export function resolveColor(value: string): [number, number, number] {
  const cached = colorCache.get(value);
  if (cached) return cached;
  let raw = value.trim();
  if (raw.startsWith("--") && typeof document !== "undefined") {
    raw = getComputedStyle(document.documentElement).getPropertyValue(raw).trim();
  }
  let rgb: [number, number, number] = [0.5, 0.5, 0.5];
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(raw);
  const long = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(raw);
  const fn = /^rgba?\(([^)]+)\)$/i.exec(raw);
  if (short) rgb = [1, 2, 3].map((i) => parseInt(short[i] + short[i], 16) / 255) as typeof rgb;
  else if (long) rgb = [1, 2, 3].map((i) => parseInt(long[i], 16) / 255) as typeof rgb;
  else if (fn) rgb = fn[1].split(/[\s,/]+/).slice(0, 3).map((n) => Number(n) / 255) as typeof rgb;
  // Only cache what resolved: a token read before the stylesheet loaded
  // should be tried again.
  if (raw) colorCache.set(value, rgb);
  return rgb;
}

/** The CSS a stop stands for: a token as var(), a hex as itself. */
export const cssColor = (stop: string) => (stop.startsWith("--") ? `var(${stop})` : stop);

/* ---------- the renderer ---------- */

class OrbRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private programs = new Map<OrbShader, Program>();
  private textures = new Map<string, WebGLTexture>();
  private views = new Set<OrbView>();
  /** The simulation (null where the GPU cannot run it) and each view's liquid. */
  private fluid: Fluid | null = null;
  private liquids = new Map<OrbView, FluidState>();
  /** Bound in place of a liquid: reads as no offset and no velocity. */
  private still: WebGLTexture | null = null;
  private frameId = 0;
  private last = 0;
  private lost = false;
  private reduce: boolean;

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduce = query.matches;
    query.addEventListener("change", (event) => {
      this.reduce = event.matches;
      this.invalidate();
    });
    document.addEventListener("visibilitychange", () => this.wake());
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.lost = true;
      this.programs.clear();
      this.textures.clear();
      // Their textures went with the context; the next voice starts afresh.
      this.liquids.clear();
      this.fluid = null;
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.lost = false;
      this.setup();
      this.invalidate();
    });
    this.setup();
  }

  /** The triangle every program draws, bound once to attribute 0. */
  private setup() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.still = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.still);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    this.fluid = Fluid.create(gl);
  }

  private compile(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("[orb] shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private program(variant: OrbShader): Program | null {
    const existing = this.programs.get(variant);
    if (existing) return existing;
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, VERTEX);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAGMENTS[variant]);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[orb] link:", gl.getProgramInfoLog(program));
      return null;
    }
    const loc: Program["loc"] = {};
    for (const name of UNIFORMS) loc[name] = gl.getUniformLocation(program, name);
    const entry = { program, loc };
    this.programs.set(variant, entry);
    return entry;
  }

  /** An image's texture, uploaded once; null until the image has loaded. */
  private texture(image: HTMLImageElement): WebGLTexture | null {
    if (!image.complete || !image.naturalWidth) return null;
    const existing = this.textures.get(image.src);
    if (existing) return existing;
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.textures.set(image.src, texture);
    return texture;
  }

  register(view: OrbView) {
    this.views.add(view);
    view.dirty = true;
    this.wake();
  }

  unregister(view: OrbView) {
    this.views.delete(view);
    const liquid = this.liquids.get(view);
    if (liquid) {
      this.fluid?.destroy(liquid);
      this.liquids.delete(view);
    }
  }

  /** Redraw every view once (a token, a motion preference or the context changed). */
  invalidate() {
    for (const view of this.views) view.dirty = true;
    this.wake();
  }

  /** Start the loop if anything could need a frame. */
  wake() {
    if (this.frameId || this.lost || document.hidden) return;
    this.last = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frameId = 0;
    // Clamped, so a frame after a pause or a slow frame does not leap.
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), 1 / 20);
    this.last = now;
    let again = false;
    for (const view of this.views) {
      if (!view.visible) continue;
      const moving = !this.reduce && view.live();
      if (!moving && !view.dirty) continue;
      const step = moving ? dt : 0;
      if (!this.draw(view, view.frame(step), step)) continue;
      view.dirty = false;
      if (moving) again = true;
    }
    if (again && !document.hidden && !this.lost) {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  /** The view's liquid, stepped by `dt`; created when its voice first has bass. */
  private liquid(view: OrbView, f: OrbFrame, dt: number): FluidState | null {
    if (!this.fluid || f.params.fluid <= 0) return null;
    let liquid = this.liquids.get(view) ?? null;
    if (!liquid && dt > 0 && f.bands[0] > 0.02) {
      liquid = this.fluid.createState(f.seed);
      this.liquids.set(view, liquid);
    }
    if (liquid) this.fluid.step(liquid, { bands: f.bands, seed: f.seed, pull: f.pull }, dt);
    return liquid;
  }

  private draw(view: OrbView, f: OrbFrame, dt: number): boolean {
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return false;
    const w = view.canvas.width;
    const h = view.canvas.height;
    if (!w || !h) return false;
    // The shared canvas only ever grows to the largest view.
    if (this.canvas.width < w || this.canvas.height < h) {
      this.canvas.width = Math.max(this.canvas.width, w);
      this.canvas.height = Math.max(this.canvas.height, h);
    }
    const entry = this.program(f.variant);
    if (!entry) return false;
    const { loc } = entry;
    // The artwork type waits for its image; the view stays dirty meanwhile.
    let texture: WebGLTexture | null = null;
    if (f.variant === "artwork") {
      texture = f.image ? this.texture(f.image) : null;
      if (!texture) return false;
    }

    // The liquid first: its passes draw into their own textures.
    const liquid = this.liquid(view, f, dt);

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(entry.program);

    gl.uniform2f(loc.uResolution, w, h);
    gl.uniform1f(loc.uTime, f.time);
    gl.uniform1f(loc.uDrift, f.drift);
    gl.uniform1f(loc.uPulse, f.pulse);
    gl.uniform4f(loc.uBands, f.bands[0], f.bands[1], f.bands[2], f.bands[3]);
    gl.uniform1f(loc.uLevel, f.level);
    gl.uniform1f(loc.uInput, f.input);
    gl.uniform1f(loc.uThink, f.think);
    gl.uniform1f(loc.uScale, f.scale);
    gl.uniform1f(loc.uDim, f.dim);
    gl.uniform1f(loc.uSeed, f.seed);
    gl.uniform3fv(loc.uC0, resolveColor(f.stops[0]));
    gl.uniform3fv(loc.uC1, resolveColor(f.stops[1]));
    gl.uniform3fv(loc.uC2, resolveColor(f.stops[2]));
    gl.uniform3fv(loc.uC3, resolveColor(f.stops[3]));
    gl.uniform1f(loc.uWarp, f.params.warp);
    gl.uniform1f(loc.uSphere, f.params.sphere);
    gl.uniform1f(loc.uDetail, f.params.detail);
    gl.uniform1f(loc.uGrain, f.params.grain);
    gl.uniform1f(loc.uPulseAmt, f.params.pulse);
    gl.uniform1f(loc.uHighlight, f.params.highlight);
    gl.uniform1f(loc.uExposure, f.params.exposure);
    gl.uniform1f(loc.uSaturation, f.params.saturation);
    if (texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(loc.uImage, 0);
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, liquid ? liquid.offset.read.texture : this.still);
    gl.uniform1i(loc.uFlow, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, liquid ? liquid.velocity.read.texture : this.still);
    gl.uniform1i(loc.uFlowVelocity, 2);
    gl.uniform1f(loc.uFlowAmt, f.params.fluid);
    gl.uniform1f(loc.uFlowDebug, FLOW_DEBUG);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The frame sits at the bottom left of the shared canvas (GL's origin);
    // in the canvas's own image that is the bottom rows. Copied in the same
    // task as the draw, so the drawing buffer is still valid.
    const ctx = view.canvas.getContext("2d");
    if (!ctx) return false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.canvas, 0, this.canvas.height - h, w, h, 0, 0, w, h);
    return true;
  }
}

let instance: OrbRenderer | null | undefined;

/** The page's renderer, or null where WebGL2 is unavailable (callers fall back to CSS). */
export function getOrbRenderer(): OrbRenderer | null {
  if (instance !== undefined) return instance;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "default",
  });
  instance = gl ? new OrbRenderer(canvas, gl) : null;
  return instance;
}
