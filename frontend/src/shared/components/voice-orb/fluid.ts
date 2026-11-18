/*!
 * Voice orb by UV · https://github.com/imuvrays1/voice-orb
 * Copyright (c) 2026 UV · MIT License (see LICENSE). Keep this notice in copies.
 */

"use client";

import { VERTEX } from "./shaders";

/**
 * A small fluid simulation per orb, for the voice to stir.
 *
 * The classic grid method ("stable fluids"): the liquid is a velocity per
 * cell of a 128 x 128 grid, stored in a half-float texture, and every frame
 * runs a few full-screen passes over it on the GPU:
 *
 *   splat      the voice pushes the liquid at three points on a ring
 *   advect     the velocity is carried along by itself, and fades
 *   divergence where the liquid would bunch up or thin out
 *   pressure   the pressure that would undo that, by Jacobi iteration
 *   gradient   subtract that pressure's slope: what is left only swirls
 *   carry      move the offset field with the flow (see below)
 *
 * The orb does not read the velocity directly. It reads an offset field: for
 * each point, how far the colour there has travelled. The flow carries the
 * offsets along and adds to them, and they relax back to zero, so speech
 * drags the colour into swirls and silence lets it drift home. Reading the
 * velocity alone would only nudge the picture while the liquid is moving and
 * snap it back as soon as it stopped.
 *
 * Units: positions are the grid's 0..1 square, which covers the ball's frame
 * edge to edge; velocities are in those units per second. Every rate is per
 * second and raised to the frame's dt, so the liquid behaves the same at 60
 * and 120 frames a second.
 *
 * Written for this lab from the textbook method (Stam 1999; GPU Gems ch. 38).
 */

export const FLUID_SIZE = 128;

/** How much of the velocity survives a second, and of the colour's offset. */
const VELOCITY_KEEP = 0.25;
const OFFSET_KEEP = 0.35;
/** Last frame's pressure as the next guess: fewer iterations for the same result. */
const PRESSURE_KEEP = 0.8;
const PRESSURE_ITERATIONS = 16;
/** The splats: three on a ring, each a gaussian of this squared radius. */
const SPLAT_COUNT = 3;
const SPLAT_RING = 0.2;
const SPLAT_RADIUS = 0.006;
/** The push per second at full bass, in grid units per second squared. */
const SPLAT_FORCE = 9;
/** Stop stepping after this long without a voice: the liquid has settled. */
const QUIET_AFTER = 6;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uTexel;
`;

const SPLAT = `${HEAD}
uniform sampler2D uVelocity;
uniform vec4 uSplats[${SPLAT_COUNT}];
uniform float uRadius;
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  for (int i = 0; i < ${SPLAT_COUNT}; i++) {
    vec2 d = vUv - uSplats[i].xy;
    v += uSplats[i].zw * exp(-dot(d, d) / uRadius);
  }
  outColor = vec4(v, 0.0, 1.0);
}
`;

/* Semi-Lagrangian: look back along the velocity to where this cell's
   contents were a moment ago, and take them from there. Unconditionally
   stable, which is why the method is called stable fluids. */
const ADVECT = `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDt;
uniform float uKeep;
void main() {
  vec2 back = vUv - uDt * texture(uVelocity, vUv).xy;
  outColor = texture(uSource, back) * uKeep;
}
`;

/* Walls: past an edge, the velocity's normal part is mirrored, so nothing
   flows out of the square. */
const DIVERGENCE = `${HEAD}
uniform sampler2D uVelocity;
void main() {
  vec2 c = texture(uVelocity, vUv).xy;
  float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  if (vUv.x - uTexel.x < 0.0) l = -c.x;
  if (vUv.x + uTexel.x > 1.0) r = -c.x;
  if (vUv.y - uTexel.y < 0.0) b = -c.y;
  if (vUv.y + uTexel.y > 1.0) t = -c.y;
  outColor = vec4((r - l + t - b) / (2.0 * uTexel.x), 0.0, 0.0, 1.0);
}
`;

/* One Jacobi step of the pressure equation: each cell becomes the average of
   its neighbours, less its divergence. Run many times, it converges. */
const PRESSURE = `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float div = texture(uDivergence, vUv).x;
  outColor = vec4((l + r + b + t - uTexel.x * uTexel.x * div) * 0.25, 0.0, 0.0, 1.0);
}
`;

const GRADIENT = `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 v = texture(uVelocity, vUv).xy - vec2(r - l, t - b) / (2.0 * uTexel.x);
  outColor = vec4(v, 0.0, 1.0);
}
`;

const SCALE = `${HEAD}
uniform sampler2D uSource;
uniform float uKeep;
void main() {
  outColor = texture(uSource, vUv) * uKeep;
}
`;

/* The offset field travels with the flow like the velocity does, and grows
   by how far the liquid moved this frame. */
const CARRY = `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uOffset;
uniform float uDt;
uniform float uKeep;
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  vec2 d = texture(uOffset, vUv - uDt * v).xy;
  outColor = vec4((d + v * uDt) * uKeep, 0.0, 1.0);
}
`;

const SOURCES = { splat: SPLAT, advect: ADVECT, divergence: DIVERGENCE, pressure: PRESSURE, gradient: GRADIENT, scale: SCALE, carry: CARRY };
type PassName = keyof typeof SOURCES;

const PASS_UNIFORMS = [
  "uTexel", "uVelocity", "uSource", "uPressure", "uDivergence", "uOffset", "uSplats",
  "uRadius", "uDt", "uKeep",
] as const;

type Pass = { program: WebGLProgram; loc: Record<string, WebGLUniformLocation | null> };

type Target = { texture: WebGLTexture; fbo: WebGLFramebuffer };
type Pair = { read: Target; write: Target };

/** One orb's liquid. */
export interface FluidState {
  velocity: Pair;
  pressure: Pair;
  divergence: Target;
  offset: Pair;
  /** Turns the ring of splats; advanced by the treble. */
  phase: number;
  /** Seconds without a voice. */
  quiet: number;
}

/** What drives a step: the voice's four bands. */
export interface FluidInput {
  bands: [number, number, number, number];
  seed: number;
  /** Pull the liquid inward (a caller being heard) instead of pushing it out. */
  pull?: boolean;
}

export class Fluid {
  private passes = new Map<PassName, Pass>();

  private constructor(private gl: WebGL2RenderingContext) {}

  /**
   * The simulation, or null where the GPU cannot render to half-float
   * textures (the orb then simply has no fluid).
   */
  static create(gl: WebGL2RenderingContext): Fluid | null {
    if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) {
      return null;
    }
    const fluid = new Fluid(gl);
    for (const name of Object.keys(SOURCES) as PassName[]) {
      if (!fluid.link(name)) return null;
    }
    // One trial target: some drivers list the extension and still refuse.
    const probe = fluid.target(fluid.gl.RG16F, fluid.gl.RG);
    if (!probe) return null;
    fluid.release(probe);
    return fluid;
  }

  private link(name: PassName): boolean {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`[orb] fluid ${name}:`, gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, SOURCES[name]);
    if (!vs || !fs) return false;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`[orb] fluid ${name} link:`, gl.getProgramInfoLog(program));
      return false;
    }
    const loc: Pass["loc"] = {};
    for (const u of PASS_UNIFORMS) loc[u] = gl.getUniformLocation(program, u);
    this.passes.set(name, { program, loc });
    return true;
  }

  /** A half-float texture to render into, filtered so advection reads between cells. */
  private target(internal: number, format: number): Target | null {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, FLUID_SIZE, FLUID_SIZE, 0, format, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (ok) {
      gl.viewport(0, 0, FLUID_SIZE, FLUID_SIZE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
      return null;
    }
    return { texture, fbo };
  }

  private pair(internal: number, format: number): Pair {
    return { read: this.target(internal, format)!, write: this.target(internal, format)! };
  }

  private release(t: Target) {
    this.gl.deleteFramebuffer(t.fbo);
    this.gl.deleteTexture(t.texture);
  }

  /** A still liquid for one orb. */
  createState(seed: number): FluidState {
    const gl = this.gl;
    return {
      velocity: this.pair(gl.RG16F, gl.RG),
      pressure: this.pair(gl.R16F, gl.RED),
      divergence: this.target(gl.R16F, gl.RED)!,
      offset: this.pair(gl.RG16F, gl.RG),
      phase: seed * 6.2831,
      quiet: 0,
    };
  }

  destroy(state: FluidState) {
    for (const pair of [state.velocity, state.pressure, state.offset]) {
      this.release(pair.read);
      this.release(pair.write);
    }
    this.release(state.divergence);
  }

  /** Has it gone still? Then stepping it changes nothing visible. */
  settled(state: FluidState) {
    return state.quiet > QUIET_AFTER;
  }

  /**
   * Bind `inputs` to texture units in order, draw into `out` (or swap and
   * draw into a pair's write side), and set the pass's other uniforms.
   */
  private run(name: PassName, out: Target, inputs: Record<string, WebGLTexture>, set?: (loc: Pass["loc"]) => void) {
    const gl = this.gl;
    const pass = this.passes.get(name)!;
    gl.useProgram(pass.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.uniform2f(pass.loc.uTexel, 1 / FLUID_SIZE, 1 / FLUID_SIZE);
    let unit = 0;
    for (const [uniform, texture] of Object.entries(inputs)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(pass.loc[uniform], unit);
      unit++;
    }
    set?.(pass.loc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private static swap(pair: Pair) {
    const t = pair.read;
    pair.read = pair.write;
    pair.write = t;
  }

  /** Advance one orb's liquid by `dt` seconds. Leaves the default framebuffer bound. */
  step(state: FluidState, input: FluidInput, dt: number) {
    if (dt <= 0) return;
    const gl = this.gl;
    const [bass, , , treble] = input.bands;
    state.quiet = bass > 0.02 ? 0 : state.quiet + dt;
    if (this.settled(state)) return;

    gl.viewport(0, 0, FLUID_SIZE, FLUID_SIZE);
    const v = state.velocity;

    // 1. Splat: three pushes on a ring around the centre, the ring turning
    // with the treble. Each pushes partly outward and partly around, at an
    // angle that sways, so the swirls change direction as the voice goes on.
    state.phase += dt * (0.35 + treble * 1.6);
    const splats = new Float32Array(SPLAT_COUNT * 4);
    // Pulling is a little gentler than pushing: listening should read as
    // drawing in, not as the orb speaking backwards.
    const force = SPLAT_FORCE * bass * dt * (input.pull ? -0.8 : 1);
    const sway = Math.PI / 2 + Math.sin(state.phase * 0.9) * 0.9;
    for (let i = 0; i < SPLAT_COUNT; i++) {
      const a = state.phase + (i / SPLAT_COUNT) * Math.PI * 2;
      const dir = a + sway;
      splats.set([
        0.5 + Math.cos(a) * SPLAT_RING,
        0.5 + Math.sin(a) * SPLAT_RING,
        Math.cos(dir) * force,
        Math.sin(dir) * force,
      ], i * 4);
    }
    this.run("splat", v.write, { uVelocity: v.read.texture }, (loc) => {
      gl.uniform4fv(loc.uSplats, splats);
      gl.uniform1f(loc.uRadius, SPLAT_RADIUS);
    });
    Fluid.swap(v);

    // 2. Advect the velocity along itself, letting it fade.
    this.run("advect", v.write, { uVelocity: v.read.texture, uSource: v.read.texture }, (loc) => {
      gl.uniform1f(loc.uDt, dt);
      gl.uniform1f(loc.uKeep, Math.pow(VELOCITY_KEEP, dt));
    });
    Fluid.swap(v);

    // 3-5. Project: remove the part of the flow that compresses, keep the swirl.
    this.run("divergence", state.divergence, { uVelocity: v.read.texture });
    const p = state.pressure;
    this.run("scale", p.write, { uSource: p.read.texture }, (loc) => {
      gl.uniform1f(loc.uKeep, PRESSURE_KEEP);
    });
    Fluid.swap(p);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      this.run("pressure", p.write, { uPressure: p.read.texture, uDivergence: state.divergence.texture });
      Fluid.swap(p);
    }
    this.run("gradient", v.write, { uPressure: p.read.texture, uVelocity: v.read.texture });
    Fluid.swap(v);

    // 6. Carry the colour's offsets with the flow, relaxing them home.
    const o = state.offset;
    this.run("carry", o.write, { uVelocity: v.read.texture, uOffset: o.read.texture }, (loc) => {
      gl.uniform1f(loc.uDt, dt);
      gl.uniform1f(loc.uKeep, Math.pow(OFFSET_KEEP, dt));
    });
    Fluid.swap(o);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
