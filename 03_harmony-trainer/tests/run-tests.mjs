import assert from "node:assert/strict";
import { classifyCents, Trainer } from "../js/trainer.js";
import { centsFromTarget, describeFrequency, detectPitch, midiToFrequency, midiToNote, noteToMidi } from "../js/pitchDetector.js";

function test(name, callback) {
  try { callback(); console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

test("音名とMIDIを相互変換できる", () => {
  assert.equal(noteToMidi("C4"), 60);
  assert.equal(noteToMidi("F#4"), 66);
  assert.equal(midiToNote(69), "A4");
  assert.equal(describeFrequency(440).note, "A4");
});

test("目標音との差をcentで計算できる", () => {
  assert.ok(Math.abs(centsFromTarget(440, 69)) < .0001);
  assert.ok(Math.abs(centsFromTarget(466.1637615, 69) - 100) < .01);
  assert.equal(classifyCents(19), "excellent");
  assert.equal(classifyCents(-39), "good");
  assert.equal(classifyCents(69), "almost");
  assert.equal(classifyCents(71), "miss");
});

test("正弦波A3の基本周波数を検出できる", () => {
  const sampleRate = 44100;
  const buffer = new Float32Array(4096);
  for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.sin(2 * Math.PI * 220 * i / sampleRate) * .35;
  const result = detectPitch(buffer, sampleRate);
  assert.ok(result.confidence > .8);
  assert.ok(Math.abs(result.frequency - 220) < 1, `検出値: ${result.frequency}`);
});

test("小音量を音程として誤判定しない", () => {
  const buffer = new Float32Array(4096).fill(.001);
  assert.equal(detectPitch(buffer, 44100).frequency, null);
});

test("±40cent以内を500ms維持すると正解になる", () => {
  const trainer = new Trainer();
  trainer.prepareSingle(4);
  trainer.start(1000);
  const frequency = midiToFrequency(trainer.targetMidi);
  assert.equal(trainer.processPitch({ frequency, confidence: .99, rms: .2 }, 1100).correct, false);
  assert.equal(trainer.processPitch({ frequency, confidence: .99, rms: .2 }, 1650).correct, true);
  assert.equal(trainer.streak, 1);
});

test("つられ耐性では主旋律付近を記録する", () => {
  const trainer = new Trainer();
  trainer.preparePhrase({ melody: ["C4"], harmony: ["E4"], tempo: 80 }, 80, "resistance");
  trainer.start(1000);
  const result = trainer.processPitch({ frequency: midiToFrequency(60), confidence: .99, rms: .2 }, 1100);
  assert.equal(result.pulledNow, true);
  assert.equal(trainer.pulled, 1);
});

console.log("HamoLab tests passed.");
