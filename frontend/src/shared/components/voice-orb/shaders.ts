/*!
 * Voice orb by UV · https://github.com/imuvrays1/voice-orb
 * Copyright (c) 2026 UV · MIT License (see LICENSE). Keep this notice in copies.
 */

import type { OrbVariant } from "./orb-data";

/** The board's four types, plus an image-driven orb used for references. */
export type OrbShader = OrbVariant | "artwork";

/*
 * The voice orb's shaders, GLSL ES 3.00 (WebGL2: fwidth without an extension).
 *
 * One full-screen triangle per orb; everything is in the fragment shader. The
 * four types share a prelude: the ball (a lens-like mapping of the flat frame
 * onto a sphere, its normal and an anti-aliased edge), the painted field (the
 * palette, domain-warped by layered value noise), the voice light (rings
 * travelling outward and a highlight arc circling the rim) and the finish
 * (film grain, saturation, exposure). Written for this project from the standard
 * techniques; no third-party shader code.
 *
 * Inputs the renderer sets every frame (see renderer.ts, OrbFrame):
 *   uDrift   the drift clock: time scaled by state, plus the voice's running
 *            total, so loud speech moves the field faster and silence coasts
 *   uPulse   the ring clock, advanced by the low-mid band
 *   uBands   bass, low mid, high mid, treble, each 0..1
 *   uLevel   overall voice level; uInput the caller's; uThink connecting
 *   uScale   the ball's radius in the frame; uDim dormant and settled fade
 */

export const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const PRELUDE = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uDrift;
uniform float uPulse;
uniform vec4 uBands;
uniform float uLevel;
uniform float uInput;
uniform float uThink;
uniform float uScale;
uniform float uDim;
uniform float uSeed;

uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;

uniform float uWarp;
uniform float uSphere;
uniform float uDetail;
uniform float uGrain;
uniform float uPulseAmt;
uniform float uHighlight;
uniform float uExposure;
uniform float uSaturation;
uniform sampler2D uImage;

/* The fluid (fluid.ts): how far the colour has travelled, and the liquid's
   velocity, both over the ball's frame. uFlowDebug draws the velocity. */
uniform sampler2D uFlow;
uniform sampler2D uFlowVelocity;
uniform float uFlowAmt;
uniform float uFlowDebug;

const float PI = 3.14159265;
const vec3 LIGHT = vec3(-0.45, 0.55, 0.70);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/* Per-pixel grain wants an integer hash: the float one above turns into
   visible stripes once pixel coordinates get large. */
float grainHash(vec2 pixel, float frame) {
  uvec2 q = uvec2(ivec2(pixel)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y ^ (uint(frame) * 2654435761u)) * 1597334673u;
  return float(n) * (1.0 / 4294967295.0);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

/* The fluid grid's coordinates for a point of the ball: its 0..1 square
   covers the frame the ball sits in. */
vec2 flowUv(vec2 p) {
  return p * 0.5 + 0.5;
}

/* Where the colour at p came from: the liquid has carried it there, by an
   offset in grid units (half the ball's -1..1 span, hence the 2). Applied
   before the sphere mapping, so carried colour still bends like a ball. */
vec2 carried(vec2 p) {
  return p - texture(uFlow, flowUv(p)).xy * 2.0 * uFlowAmt;
}

/* A point of the frame, -1..1 across the ball, to the field's coordinates:
   magnified at the centre and compressed toward the edge, as looking at a
   ball does. uSphere 0 is flat. */
vec2 sphereMap(vec2 p) {
  float z = sqrt(max(1.0 - dot(p, p), 0.0));
  return p / (1.0 + uSphere * z);
}

struct Ball {
  vec2 p;    // -1..1 across the ball
  vec2 uv;   // the field's coordinates after the sphere mapping
  vec3 n;    // surface normal
  float r;   // distance from the centre, 1 at the edge
  float mask;
};

Ball ball() {
  Ball b;
  b.p = (vUv - 0.5) * 2.0 / uScale;
  b.r = length(b.p);
  float aa = max(fwidth(b.r) * 1.25, 1e-4);
  b.mask = 1.0 - smoothstep(1.0 - aa, 1.0, b.r);
  float z = sqrt(max(1.0 - b.r * b.r, 0.0));
  b.n = vec3(b.p, z);
  b.uv = sphereMap(carried(b.p));

  // The voice moves the field rather than lighting it: waves travel outward
  // through the colour (low mid), and the bass breathes the whole field in
  // and out, so speech reads as something pushing through liquid.
  float ph = fract(b.r * 1.35 - uPulse);
  float wave = sin(ph * 2.0 * PI) * smoothstep(0.0, 0.2, ph) * (1.0 - smoothstep(0.55, 1.0, ph));
  vec2 dir = b.r > 1e-4 ? b.p / b.r : vec2(0.0);
  b.uv += dir * wave * uBands.y * uPulseAmt * 0.075 * smoothstep(0.05, 0.3, b.r);
  b.uv *= 1.0 - uBands.x * 0.06;
  return b;
}

/* Two octaves only: the field is meant to be soft, large areas of colour,
   not texture. */
float fbmSoft(vec2 p) {
  return vnoise(p) * 0.66 + vnoise(p * 2.1 + 17.1) * 0.34;
}

/* One soft light: a gaussian stretched along its angle by its stretch, so the
   lights can be streaks as well as pools. */
float softLight(vec2 w, vec2 p, float size, float angle, float stretch) {
  vec2 d = w - p;
  float c = cos(angle);
  float s = sin(angle);
  d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  d.y *= stretch;
  return exp(-dot(d, d) * size);
}

/* The painted field: a mid-tone ground lit by six soft lights of the
   palette (a deep pool and a darker streak, a light wash and a light streak,
   the glint and its brightest point), each drifting and turning on its own
   slow orbit. The whole field is bent twice by low-frequency noise, the
   second time finer, which is what draws the lights out into streaks.
   Painted light rather than texture: no edge in it is sharper than a
   gaussian. */
vec3 field(vec2 uv, float t) {
  vec2 s = vec2(uSeed * 13.7, uSeed * 7.3);
  vec2 q = vec2(
    fbmSoft(uv * uDetail + s + vec2(0.0, t * 0.11)),
    fbmSoft(uv * uDetail + s + vec2(5.2, -t * 0.09))
  ) - 0.5;
  vec2 w = uv + q * uWarp * 1.3;
  vec2 q2 = vec2(
    fbmSoft(w * uDetail * 2.2 + s + vec2(t * 0.07, 3.1)),
    fbmSoft(w * uDetail * 2.2 + s + vec2(9.2, -t * 0.06))
  ) - 0.5;
  w += q2 * uWarp * 0.5;

  float a = uSeed * 6.2831;
  vec3 col = mix(uC1, uC2, 0.3);
  col = mix(col, uC0, softLight(w, vec2(cos(t * 0.21 + a), sin(t * 0.17 + a * 1.3)) * 0.55, 2.0, t * 0.05 + a, 1.4) * 0.9);
  col = mix(col, mix(uC0, uC1, 0.5), softLight(w, vec2(cos(t * 0.15 + a + 1.0), sin(t * 0.19 + a + 2.2)) * 0.45, 4.0, -t * 0.07 + a * 2.0, 2.6) * 0.8);
  col = mix(col, uC2, softLight(w, vec2(cos(t * 0.17 + a + 2.1), sin(t * 0.21 + a + 1.4)) * 0.5, 2.4, t * 0.04 + 1.1, 1.2) * 0.85);
  col = mix(col, uC2, softLight(w, vec2(cos(t * 0.25 + a + 3.3), sin(t * 0.13 + a + 4.4)) * 0.4, 6.0, t * 0.09 + a + 0.6, 3.0) * 0.75);
  col = mix(col, uC3, softLight(w, vec2(cos(t * 0.29 + a + 4.0), sin(t * 0.25 + a + 3.3)) * 0.42, 5.0, -t * 0.06 + 2.0, 1.6) * 0.8);
  col = mix(col, mix(uC3, vec3(1.0), 0.45), softLight(w, vec2(cos(t * 0.19 + a + 5.1), sin(t * 0.23 + a + 0.6)) * 0.35, 11.0, t * 0.08 + a, 2.2) * 0.7);
  // A breath of low-frequency variation, so no wash is perfectly flat.
  col *= 0.94 + 0.12 * fbmSoft(w * 1.4 + s + t * 0.05);
  return col;
}

float diffuse(vec3 n) {
  return clamp(dot(n, normalize(LIGHT)), 0.0, 1.0);
}

/* What the voice adds: rings travelling outward, lit by the low-mid band,
   and a highlight circling near the rim, lit by the treble, the caller's
   level or the connecting wander. */
vec3 voiceLight(Ball b) {
  float ph = fract(b.r * 1.35 - uPulse);
  float ring = smoothstep(0.0, 0.16, ph) * (1.0 - smoothstep(0.16, 0.5, ph));
  // Born a little way out, so a ring never flashes as a dot at the centre.
  ring *= (1.0 - 0.55 * b.r) * smoothstep(0.05, 0.3, b.r);
  vec3 c = uC2 * ring * uBands.y * uPulseAmt * 0.14;

  float ang = atan(b.p.y, b.p.x);
  float aim = uDrift * 0.7 + uSeed * 6.0 - uInput * 1.2;
  float da = abs(mod(ang - aim + PI, 2.0 * PI) - PI);
  float arc = exp(-da * da * 2.6) * smoothstep(0.5, 0.9, b.r) * (1.0 - smoothstep(0.94, 1.0, b.r));
  float drive = clamp(uBands.w * 2.4 + uThink * 0.6 + uInput * 0.8, 0.0, 1.0);
  c += mix(uC2, uC3, 0.6) * arc * drive * uHighlight;
  return c;
}

/* Film grain, then saturation and exposure. The dormant fade drains colour
   rather than going grey. */
vec3 finish(vec3 col) {
  float g = grainHash(gl_FragCoord.xy, floor(uTime * 24.0)) - 0.5;
  col += g * uGrain * 0.35;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation * (1.0 - uDim * 0.22));
  col *= 1.0 + uExposure - uDim * 0.05;
  return clamp(col, 0.0, 1.0);
}

void emit(vec3 col, float alpha) {
  // ?flow in the address: the liquid's velocity as colour, grey where still,
  // red and green for the x and y of its motion. ?flow=grid: a grid drawn
  // through the same offsets as the colour, to see how the liquid drags it.
  if (uFlowDebug > 0.5) {
    vec2 p = (vUv - 0.5) * 2.0 / uScale;
    if (uFlowDebug < 1.5) {
      vec2 v = texture(uFlowVelocity, flowUv(p)).xy;
      col = vec3(0.5 + v * 2.5, 0.5 + length(v) * 1.5);
    } else {
      vec2 g = abs(fract(carried(p) * 5.0) - 0.5);
      float line = 1.0 - smoothstep(0.0, fwidth(g.x) * 1.5, min(g.x, g.y) - 0.02);
      col = mix(vec3(0.96), uC0, line);
    }
  }
  outColor = vec4(col * alpha, alpha);
}
`;

/* Painted: the field on the ball, lit from the top left, falling toward the
   deep stop at the rim. */
const PAINTED = `${PRELUDE}
void main() {
  Ball b = ball();
  if (b.mask <= 0.0) { outColor = vec4(0.0); return; }
  vec3 col = field(b.uv, uDrift);
  col *= mix(0.74, 1.14, diffuse(b.n));
  float rim = pow(1.0 - b.n.z, 2.2);
  col = mix(col, uC0 * 0.85, rim * 0.42);
  // A broad sheen at the top left, the light the ball sits in.
  vec3 h = normalize(normalize(LIGHT) + vec3(0.0, 0.0, 1.0));
  col += pow(clamp(dot(b.n, h), 0.0, 1.0), 9.0) * 0.1;
  col += voiceLight(b);
  emit(finish(col), b.mask);
}
`;

/* Glass: the field seen through a milky ball, caustic threads inside, a
   bright fresnel rim and a sharp specular point. */
const GLASS = `${PRELUDE}
void main() {
  Ball b = ball();
  if (b.mask <= 0.0) { outColor = vec4(0.0); return; }
  float t = uDrift;
  vec2 refr = b.uv * (1.0 - 0.25 * b.n.z) + b.n.xy * 0.08;
  vec3 inside = field(refr * 1.1, t * 0.8);
  inside = mix(inside, mix(uC2, vec3(1.0), 0.3), 0.42);

  // Caustics: soft bright veins, faint at rest, brighter with the voice.
  float n = fbmSoft(b.uv * uDetail * 2.0 + vec2(t * 0.2, -t * 0.15) + uSeed);
  float threads = pow(1.0 - abs(sin(n * 7.0 + t * 0.5)), 6.0);
  threads *= 0.18 + uLevel * 0.7 + uThink * 0.25 + uBands.x * 0.3;
  vec3 col = inside + mix(uC3, vec3(1.0), 0.3) * threads * 0.5 * (0.5 + uWarp * 0.5);

  float fres = pow(1.0 - b.n.z, 3.0);
  col = mix(col, mix(uC2, vec3(1.0), 0.55), fres * 0.85);
  col *= mix(0.84, 1.06, diffuse(b.n));

  vec3 h = normalize(normalize(LIGHT) + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(dot(b.n, h), 0.0, 1.0), 70.0);
  col += spec * 0.9;

  col += voiceLight(b);
  emit(finish(col), b.mask);
}
`;

/* Silk: four ribbons of the palette across the ball, an aurora drawn
   inside a sphere. Speech lifts and widens them. */
const SILK = `${PRELUDE}
void main() {
  Ball b = ball();
  if (b.mask <= 0.0) { outColor = vec4(0.0); return; }
  float t = uDrift;
  vec2 uv = b.uv * 1.25;
  vec3 col = field(b.uv, t * 0.6) * 0.92;
  float amp = 0.16 + uLevel * 0.22 + uBands.x * 0.18;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float y = sin(uv.x * (2.1 + fi * 0.7) + t * (0.9 + fi * 0.25) + fi * 1.7 + uSeed * 6.0)
            * amp * (0.65 + 0.35 * sin(t * 0.3 + fi))
            + (fi - 1.5) * 0.27;
    y += (fbm(uv * uDetail + vec2(fi * 3.1, t * 0.1)) - 0.5) * uWarp * 0.5;
    float d = uv.y - y;
    float width = 0.06 + 0.06 * uBands.y + 0.02 * fi;
    float glow = exp(-d * d / (width * width));
    vec3 rc = i == 0 ? uC2 : (i == 1 ? uC3 : (i == 2 ? mix(uC2, vec3(1.0), 0.4) : uC3));
    // Screen, so ribbons brighten the ground without blowing it out.
    vec3 add = rc * glow * (0.38 + 0.45 * uLevel);
    col = 1.0 - (1.0 - col) * (1.0 - add);
  }
  col *= mix(0.78, 1.1, diffuse(b.n));
  col = mix(col, uC0 * 0.8, pow(1.0 - b.n.z, 2.4) * 0.4);
  col += voiceLight(b);
  emit(finish(col), b.mask);
}
`;

/* Halftone: the painted field printed as a dot screen on a pale ground.
   Each dot reads the field at its cell's centre, so the screen stays a
   screen; darker field, bigger dot. Speech swells the dots. */
const HALFTONE = `${PRELUDE}
void main() {
  Ball b = ball();
  if (b.mask <= 0.0) { outColor = vec4(0.0); return; }
  float cells = 22.0;
  vec2 gv = b.p * cells * 0.5;
  vec2 id = floor(gv);
  vec2 f = fract(gv) - 0.5;
  vec2 cp = (id + 0.5) / (cells * 0.5);
  float inside = step(length(cp), 1.0);
  vec3 c = field(sphereMap(carried(cp)), uDrift);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float z = sqrt(max(1.0 - dot(cp, cp), 0.0));
  float shade = mix(0.7, 1.0, clamp(dot(vec3(cp, z), normalize(LIGHT)), 0.0, 1.0));
  float ph = fract(length(cp) * 1.35 - uPulse);
  float ring = (smoothstep(0.0, 0.16, ph) * (1.0 - smoothstep(0.16, 0.5, ph))) * uBands.y * uPulseAmt
             * smoothstep(0.05, 0.3, length(cp));
  float radius = sqrt(clamp(1.15 - l * shade, 0.08, 1.0)) * 0.52 * (0.9 + uLevel * 0.35 + ring * 0.4);
  float aa = fwidth(length(f)) * 1.2;
  float dot1 = 1.0 - smoothstep(radius - aa, radius, length(f));
  vec3 paper = mix(uC2, vec3(1.0), 0.8);
  vec3 ink = mix(uC0, uC1, smoothstep(0.35, 0.85, l));
  vec3 col = mix(paper, ink, dot1 * inside);
  col += voiceLight(b) * 0.5;
  emit(finish(col), b.mask);
}
`;

/* Artwork: a painted image of a ball instead of the procedural field, the
   way artwork-led orbs are built. The image already carries its own light,
   so this only moves inside it: the same lens, warp and voice ripple as the
   other types, sampled from the image. */
const ARTWORK = `${PRELUDE}
void main() {
  Ball b = ball();
  if (b.mask <= 0.0) { outColor = vec4(0.0); return; }
  vec2 s = vec2(uSeed * 13.7, uSeed * 7.3);
  vec2 q = vec2(
    fbmSoft(b.uv * uDetail + s + vec2(0.0, uDrift * 0.11)),
    fbmSoft(b.uv * uDetail + s + vec2(5.2, -uDrift * 0.09))
  ) - 0.5;
  vec2 uv = b.uv * 0.47 + 0.5 + q * uWarp * 0.16;
  vec3 col = texture(uImage, uv).rgb;
  col += voiceLight(b) * 0.6;
  emit(finish(col), b.mask);
}
`;

export const FRAGMENTS: Record<OrbShader, string> = {
  painted: PAINTED,
  glass: GLASS,
  silk: SILK,
  halftone: HALFTONE,
  artwork: ARTWORK,
};
