import { centsFromTarget, frequencyToMidi, midiToNote, noteToMidi } from "./pitchDetector.js";
import { SINGLE_ROOTS } from "../data/exercises.js";

export const THRESHOLDS = Object.freeze({ excellent: 20, good: 40, almost: 70, holdMs: 500 });
const RANGE_SHIFT = { low: -12, mid: 0, high: 12 };

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

export function classifyCents(cents) {
  const absolute = Math.abs(cents);
  if (absolute <= THRESHOLDS.excellent) return "excellent";
  if (absolute <= THRESHOLDS.good) return "good";
  if (absolute <= THRESHOLDS.almost) return "almost";
  return "miss";
}

export class Trainer {
  constructor() { this.reset(); }

  reset() {
    this.mode = "single";
    this.interval = 4;
    this.melodyMidi = 60;
    this.targetMidi = 64;
    this.phrase = null;
    this.bpm = 80;
    this.startedAt = 0;
    this.samples = [];
    this.recentMidi = [];
    this.correctSince = 0;
    this.streak = 0;
    this.correctLatched = false;
    this.pulled = 0;
    this.lastPulledAt = -Infinity;
  }

  prepareSingle(interval, range = "mid") {
    this.mode = "single";
    const chosen = interval === "random" ? (Math.random() > .5 ? 4 : -4) : Number(interval);
    const root = noteToMidi(SINGLE_ROOTS[Math.floor(Math.random() * SINGLE_ROOTS.length)]) + RANGE_SHIFT[range];
    this.interval = chosen;
    this.melodyMidi = root;
    this.targetMidi = root + chosen;
    this.correctSince = 0;
    this.correctLatched = false;
    this.recentMidi.length = 0;
    return this.currentNotes();
  }

  preparePhrase(exercise, bpm, mode = "phrase", range = "mid") {
    this.reset();
    this.mode = mode;
    const shift = RANGE_SHIFT[range];
    this.phrase = {
      ...exercise,
      melodyMidi: exercise.melody.map((note) => noteToMidi(note) + shift),
      harmonyMidi: exercise.harmony.map((note) => noteToMidi(note) + shift)
    };
    this.bpm = bpm || exercise.tempo;
    this.melodyMidi = this.phrase.melodyMidi[0];
    this.targetMidi = this.phrase.harmonyMidi[0];
    return this.currentNotes();
  }

  start(now = performance.now()) {
    this.startedAt = now;
    this.samples = [];
    this.correctSince = 0;
    this.correctLatched = false;
    this.pulled = 0;
    this.lastPulledAt = -Infinity;
  }

  get phraseDurationMs() { return this.phrase ? this.phrase.harmonyMidi.length * 60000 / this.bpm : 0; }

  updatePhraseTarget(now = performance.now()) {
    if (!this.phrase || !this.startedAt) return null;
    const beatMs = 60000 / this.bpm;
    const index = Math.min(this.phrase.harmonyMidi.length - 1, Math.max(0, Math.floor((now - this.startedAt) / beatMs)));
    this.melodyMidi = this.phrase.melodyMidi[index];
    this.targetMidi = this.phrase.harmonyMidi[index];
    return { index, ...this.currentNotes() };
  }

  currentNotes() {
    return { melodyMidi: this.melodyMidi, targetMidi: this.targetMidi, melody: midiToNote(this.melodyMidi), target: midiToNote(this.targetMidi), interval: this.targetMidi - this.melodyMidi };
  }

  processPitch(detection, now = performance.now()) {
    if (!detection.frequency || detection.confidence < .68) {
      this.correctSince = 0;
      return { voiced: false, rms: detection.rms };
    }
    if (this.phrase) this.updatePhraseTarget(now);
    const midiFloat = frequencyToMidi(detection.frequency);
    this.recentMidi.push(midiFloat);
    if (this.recentMidi.length > 5) this.recentMidi.shift();
    const stability = standardDeviation(this.recentMidi);
    if (stability > .34) {
      this.correctSince = 0;
      return { voiced: false, unstable: true, rms: detection.rms };
    }
    const smoothedMidi = this.recentMidi.reduce((sum, value) => sum + value, 0) / this.recentMidi.length;
    const smoothedFrequency = 440 * (2 ** ((smoothedMidi - 69) / 12));
    const cents = centsFromTarget(smoothedFrequency, this.targetMidi);
    const rating = classifyCents(cents);
    const sample = { time: now - this.startedAt, midi: smoothedMidi, target: this.targetMidi, melody: this.melodyMidi, cents, rating };
    this.samples.push(sample);

    // 目標より主旋律に40cent以内で近づいた状態を、1回の「つられ」と数えます。
    const melodyCents = Math.abs((smoothedMidi - this.melodyMidi) * 100);
    const targetCents = Math.abs((smoothedMidi - this.targetMidi) * 100);
    let pulledNow = false;
    if (this.mode === "resistance" && melodyCents <= 40 && targetCents > 70 && now - this.lastPulledAt > 700) {
      this.pulled += 1; this.lastPulledAt = now; pulledNow = true;
    }

    let correct = false;
    if (Math.abs(cents) <= THRESHOLDS.good) {
      if (!this.correctSince) this.correctSince = now;
      if (!this.correctLatched && now - this.correctSince >= THRESHOLDS.holdMs) {
        correct = true; this.correctLatched = true; this.streak += 1;
      }
    } else {
      this.correctSince = 0;
      if (Math.abs(cents) > THRESHOLDS.almost) this.correctLatched = false;
    }
    return { voiced: true, frequency: smoothedFrequency, midiFloat: smoothedMidi, cents, rating, correct, pulledNow, rms: detection.rms };
  }

  getResults() {
    const samples = this.samples;
    const voiced = samples.length;
    const accurate = samples.filter((item) => Math.abs(item.cents) <= THRESHOLDS.good).length;
    const pitch = voiced ? Math.round(accurate / voiced * 100) : 0;
    const deviations = samples.map((item) => item.cents);
    const stability = voiced ? Math.max(0, Math.round(100 - Math.min(100, standardDeviation(deviations) * 1.4))) : 0;
    const expectedSamples = this.phraseDurationMs ? this.phraseDurationMs / 80 : Math.max(voiced, 1);
    const timing = Math.min(100, Math.round(voiced / expectedSamples * 100));
    const resistance = this.mode === "resistance" ? Math.max(0, 100 - this.pulled * 18) : 100;
    const score = Math.round(pitch * .45 + stability * .25 + timing * .2 + resistance * .1);
    const highSamples = samples.filter((item) => item.target >= 67);
    const highAverage = highSamples.length ? highSamples.reduce((sum, item) => sum + item.cents, 0) / highSamples.length : 0;
    let comment = "目標音をよく聴きながら、息を一定に保ってみましょう。";
    if (score >= 85) comment = "音程の芯が安定しています。この感覚のままガイド音を減らしてみましょう。";
    else if (highAverage < -15) comment = "高い音で少しフラットする傾向があります。息の流れを止めずに狙ってみましょう。";
    else if (this.pulled > 0) comment = `主旋律に${this.pulled}回近づきました。先にハモリ音を頭の中で鳴らしてから歌うと安定します。`;
    return { score, pitch, stability, timing, resistance, pulled: this.pulled, comment };
  }
}
