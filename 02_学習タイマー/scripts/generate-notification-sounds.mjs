import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 44_100;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, "..", "audio");

function createTrack(seconds) {
  return new Float64Array(Math.ceil(seconds * sampleRate));
}

function envelope(time, duration, attack = 0.012, release = 0.18) {
  const attackGain = Math.min(1, time / Math.max(0.001, attack));
  const releaseStart = Math.max(attack, duration - release);
  const releaseGain = time < releaseStart ? 1 : Math.max(0, (duration - time) / Math.max(0.001, release));
  return attackGain * releaseGain;
}

function addTone(track, { start, duration, frequency, amplitude = 0.35, waveform = "sine", attack, release }) {
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(track.length, Math.ceil((start + duration) * sampleRate));
  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const phase = 2 * Math.PI * frequency * time;
    const wave = waveform === "square" ? (Math.sin(phase) >= 0 ? 1 : -1)
      : waveform === "triangle" ? 2 / Math.PI * Math.asin(Math.sin(phase))
        : Math.sin(phase);
    track[index] += wave * amplitude * envelope(time, duration, attack, release);
  }
}

function addBellStrike(track, start, frequency, amplitude = 0.34) {
  const partials = [
    [1, 1], [2.01, 0.42], [2.72, 0.22], [3.93, 0.13]
  ];
  const startSample = Math.floor(start * sampleRate);
  const duration = 1.05;
  const endSample = Math.min(track.length, Math.ceil((start + duration) * sampleRate));
  for (let index = startSample; index < endSample; index += 1) {
    const time = (index - startSample) / sampleRate;
    const decay = Math.exp(-3.3 * time);
    const attack = Math.min(1, time / 0.004);
    let value = 0;
    for (const [ratio, weight] of partials) {
      value += Math.sin(2 * Math.PI * frequency * ratio * time) * weight;
    }
    track[index] += value * amplitude * decay * attack;
  }
}

function normalize(track) {
  let peak = 0;
  for (const value of track) peak = Math.max(peak, Math.abs(value));
  const scale = peak > 0 ? 0.86 / peak : 1;
  for (let index = 0; index < track.length; index += 1) track[index] *= scale;
  return track;
}

function encodeWav(track) {
  const dataLength = track.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  for (let index = 0; index < track.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, track[index]));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

const sounds = {
  "clear-chime.wav": () => {
    const track = createTrack(1.35);
    [[0, 659.25], [0.2, 783.99], [0.4, 987.77]].forEach(([start, frequency]) => {
      addTone(track, { start, duration: 0.62, frequency, amplitude: 0.34, release: 0.34 });
      addTone(track, { start, duration: 0.52, frequency: frequency * 2, amplitude: 0.08, release: 0.3 });
    });
    return track;
  },
  "bell.wav": () => {
    const track = createTrack(1.45);
    addBellStrike(track, 0, 523.25, 0.4);
    addBellStrike(track, 0.48, 659.25, 0.34);
    return track;
  },
  "digital.wav": () => {
    const track = createTrack(1.05);
    [[0, 880], [0.18, 880], [0.4, 1174.66], [0.62, 1174.66]].forEach(([start, frequency]) => {
      addTone(track, { start, duration: 0.1, frequency, amplitude: 0.28, waveform: "square", attack: 0.003, release: 0.015 });
    });
    return track;
  },
  "school-bell.wav": () => {
    const track = createTrack(1.7);
    [[0, 392], [0.32, 523.25], [0.64, 440], [0.96, 587.33]].forEach(([start, frequency]) => {
      addBellStrike(track, start, frequency, 0.29);
    });
    return track;
  },
  "gentle.wav": () => {
    const track = createTrack(1.55);
    [[0, 261.63], [0.28, 392], [0.56, 523.25]].forEach(([start, frequency]) => {
      addTone(track, { start, duration: 0.78, frequency, amplitude: 0.3, waveform: "triangle", attack: 0.08, release: 0.42 });
    });
    return track;
  }
};

const volumeVariants = Object.freeze({
  low: 0.06,
  medium: 0.28,
  high: 1
});

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [filename, render] of Object.entries(sounds)) {
  const normalizedTrack = normalize(render());
  const fileStem = filename.replace(/\.wav$/i, "");
  for (const [volume, amplitude] of Object.entries(volumeVariants)) {
    const variantFilename = volume === "high" ? filename : `${fileStem}-${volume}.wav`;
    const variantTrack = Float64Array.from(normalizedTrack, (sample) => sample * amplitude);
    const outputPath = path.join(outputDirectory, variantFilename);
    fs.writeFileSync(outputPath, encodeWav(variantTrack));
    console.log(`${variantFilename}: ${fs.statSync(outputPath).size} bytes`);
  }
}
