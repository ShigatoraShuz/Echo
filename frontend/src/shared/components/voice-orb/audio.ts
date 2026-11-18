/*!
 * Voice orb by UV · https://github.com/imuvrays1/voice-orb
 * Copyright (c) 2026 UV · MIT License (see LICENSE). Keep this notice in copies.
 */

"use client";

/**
 * Where an orb hears a voice: four bands and an overall level, read once per
 * frame by the orb.
 *
 * Bands, by frequency: bass (90-350 Hz), low mid (350 Hz-1.1 kHz), high mid
 * (1.1-2.8 kHz) and treble (2.8-7 kHz). The edges sit where a call carries
 * speech: telephone audio has little below 300 Hz, so a classic 80-250 Hz bass
 * band would mostly measure line hum. Each follows the voice with a fast attack
 * and a slow release, so a syllable lands at once and its tail fades rather
 * than flickering.
 *
 * Levels calibrate themselves. A recording, a microphone and a live call all
 * arrive at different loudness, and a fixed scale either pins loud speech at
 * the top or leaves quiet speech at the bottom. So each band reads the
 * spectrum in decibels over a wide range (nothing clips), then scales between
 * its own recent quiet floor and loud peak: the floor drops at once to any
 * silence and creeps up slowly, the peak jumps to any loud moment and sinks
 * slowly. What reaches the orb is the voice's rise and fall at any level.
 *
 * Sources:
 *   AnalyserLevels   any Web Audio AnalyserNode: a playing <audio> element
 *                    (analyserForElement), the microphone (openMicrophone),
 *                    this tab's sound (openTabAudio), or a voice SDK's
 *                    analyser in a live call
 *   SimulatedVoice   a synthetic speech envelope, for orbs with nothing to
 *                    play and for the board's state cards
 */

export type Bands = [number, number, number, number];

export interface OrbLevels {
  bands: Bands;
  level: number;
}

export interface LevelSource {
  read(dt: number): OrbLevels;
  /**
   * A second reader of the same voice. A source keeps its own envelope and
   * clock, so two orbs reading one source would each advance it; give the
   * second orb a twin instead.
   */
  twin?(): LevelSource;
}

const EDGES = [90, 350, 1100, 2800, 7000];
/* The decibel window a band is read in before calibration: wide enough that
   speech never clips at the top. */
const DB_LOW = -95;
const DB_HIGH = -20;
/* How fast the calibration moves, per second: the peak sinks, the floor rises.
   The floor drops at once in every gap between syllables, so rising fairly
   quickly the rest of the time makes it track the background, not the voice. */
const PEAK_FALL = 0.05;
const FLOOR_RISE = 0.15;
/* The smallest span between floor and peak: below it, room tone would be
   stretched into a voice. */
const MIN_SPAN = 0.14;

const ATTACK = 28;
const RELEASE = 8;

function follow(current: number, target: number, dt: number) {
  const rate = target > current ? ATTACK : RELEASE;
  return current + (target - current) * (1 - Math.exp(-dt * rate));
}

const levelOf = (b: Bands) => Math.min(1, b[0] * 0.32 + b[1] * 0.36 + b[2] * 0.22 + b[3] * 0.1);

export class AnalyserLevels implements LevelSource {
  private data: Float32Array<ArrayBuffer> | null = null;
  private env: Bands = [0, 0, 0, 0];
  private floor: Bands = [1, 1, 1, 1];
  private peak: Bands = [0, 0, 0, 0];

  constructor(private analyser: AnalyserNode) {}

  twin(): LevelSource {
    return new AnalyserLevels(this.analyser);
  }

  read(dt: number): OrbLevels {
    const a = this.analyser;
    const step = dt || 1 / 60;
    if (!this.data || this.data.length !== a.frequencyBinCount) {
      this.data = new Float32Array(a.frequencyBinCount);
    }
    a.getFloatFrequencyData(this.data);
    const hzPerBin = a.context.sampleRate / a.fftSize;
    for (let band = 0; band < 4; band++) {
      const from = Math.max(1, Math.floor(EDGES[band] / hzPerBin));
      const to = Math.min(this.data.length, Math.ceil(EDGES[band + 1] / hzPerBin));
      // Average the band's power, not its decibels, then back to decibels.
      let power = 0;
      for (let i = from; i < to; i++) {
        const db = this.data[i];
        if (Number.isFinite(db)) power += Math.pow(10, db / 10);
      }
      const db = to > from && power > 0 ? 10 * Math.log10(power / (to - from)) : DB_LOW;
      const raw = Math.min(1, Math.max(0, (db - DB_LOW) / (DB_HIGH - DB_LOW)));

      this.floor[band] = Math.min(raw, this.floor[band] + FLOOR_RISE * step);
      this.peak[band] = Math.max(raw, this.peak[band] - PEAK_FALL * step);
      const span = Math.max(this.peak[band] - this.floor[band], MIN_SPAN);
      const value = Math.pow(Math.min(1, Math.max(0, (raw - this.floor[band]) / span)), 1.8);
      this.env[band] = follow(this.env[band], value, step);
    }
    return { bands: [...this.env] as Bands, level: levelOf(this.env) };
  }
}
