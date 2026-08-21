export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SOLFEGE_NAMES = ["ド", "ド♯", "レ", "レ♯", "ミ", "ファ", "ファ♯", "ソ", "ソ♯", "ラ", "ラ♯", "シ"];

export function midiToFrequency(midi) {
  return 440 * (2 ** ((midi - 69) / 12));
}

export function frequencyToMidi(frequency) {
  return 69 + (12 * Math.log2(frequency / 440));
}

export function noteToMidi(note) {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(note);
  if (!match) throw new Error(`不正な音名です: ${note}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + base + accidental;
}

export function midiToNote(midiValue) {
  const midi = Math.round(midiValue);
  return `${NOTE_NAMES[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function describeFrequency(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const midiFloat = frequencyToMidi(frequency);
  const midi = Math.round(midiFloat);
  return {
    frequency,
    midi,
    midiFloat,
    note: midiToNote(midi),
    solfege: SOLFEGE_NAMES[(midi % 12 + 12) % 12],
    cents: Math.round((midiFloat - midi) * 100)
  };
}

export function centsFromTarget(frequency, targetMidi) {
  return 1200 * Math.log2(frequency / midiToFrequency(targetMidi));
}

// 差分関数を使ったYIN系の基本周波数検出。
// 音量不足、周期性の弱い雑音、声域外の結果は null にして誤検出を抑えます。
export function detectPitch(buffer, sampleRate, options = {}) {
  const minFrequency = options.minFrequency ?? 75;
  const maxFrequency = options.maxFrequency ?? 1000;
  const rmsThreshold = options.rmsThreshold ?? 0.012;
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < rmsThreshold) return { frequency: null, confidence: 0, rms };

  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxTau = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(buffer.length / 2));
  const difference = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    for (let i = 0; i < buffer.length - tau; i += 1) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }

  let runningSum = 0;
  const normalized = new Float32Array(maxTau + 1);
  normalized[0] = 1;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    normalized[tau] = runningSum ? difference[tau] * tau / runningSum : 1;
  }

  let bestTau = -1;
  for (let tau = minTau; tau < maxTau; tau += 1) {
    if (normalized[tau] < 0.16) {
      while (tau + 1 < maxTau && normalized[tau + 1] < normalized[tau]) tau += 1;
      bestTau = tau;
      break;
    }
  }
  if (bestTau < 0) {
    let minimum = 0.32;
    for (let tau = minTau; tau <= maxTau; tau += 1) {
      if (normalized[tau] < minimum) { minimum = normalized[tau]; bestTau = tau; }
    }
  }
  if (bestTau < 0) return { frequency: null, confidence: 0, rms };

  // 放物線補間で整数サンプル間の周期を推定し、表示の揺れを減らします。
  const prev = normalized[bestTau - 1] ?? normalized[bestTau];
  const current = normalized[bestTau];
  const next = normalized[bestTau + 1] ?? current;
  const denominator = 2 * (2 * current - next - prev);
  const refinedTau = denominator ? bestTau + (next - prev) / denominator : bestTau;
  const confidence = Math.max(0, Math.min(1, 1 - current));
  return { frequency: sampleRate / refinedTau, confidence, rms };
}
