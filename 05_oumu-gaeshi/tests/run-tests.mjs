import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../js/main.js", import.meta.url), "utf8");
const effectsSource = fs.readFileSync(new URL("../js/audio-effects.js", import.meta.url), "utf8");
const storageSource = fs.readFileSync(new URL("../js/storage.js", import.meta.url), "utf8");
const workletSource = fs.readFileSync(new URL("../js/pcm-recorder-worklet.js", import.meta.url), "utf8");

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");
const referencedIds = [...main.matchAll(/byId\("([^"]+)"\)/g)].map((match) => match[1]);
for (const id of referencedIds) assert.ok(ids.includes(id), `missing DOM node: ${id}`);

for (const label of ["ロボット", "宇宙人", "洞窟", "電話", "ランダム", "カオス", "履歴・お気に入り", "Pitch Shift方式"]) {
  assert.ok(html.includes(label), `missing expanded UI: ${label}`);
}
assert.ok(html.indexOf("audio-effects.js") < html.indexOf("main.js"), "effects must load before main");
assert.ok(main.includes("recordingPcmChunks = preRollChunks"), "pre-roll must remain enabled");
assert.ok(main.includes("MAX_HISTORY = 10"), "history must stay bounded");
assert.ok(main.includes("window.OumuEffects.stopAll()"), "audio nodes must be stoppable");
assert.ok(storageSource.includes("indexedDB.open"), "favorites must use IndexedDB");

const effectsWindow = {};
vm.runInNewContext(effectsSource, { window: effectsWindow, console, setTimeout, clearTimeout });
const effects = effectsWindow.OumuEffects;
assert.ok(effects, "effects module must be exported");
assert.equal(effects.resolvePreset("parrot", {}, "normal").pitch, 5);
assert.equal(effects.resolvePreset("tiny", {}, "normal").pitch, 11);
assert.equal(effects.resolvePreset("monster", {}, "normal").pitch, -10);
assert.equal(effects.resolvePreset("telephone", {}, "normal").highPass, 300);
assert.equal(effects.resolvePreset("reverse", {}, "normal").reverse, true);
assert.equal(effects.resolvePreset("parrot", {}, "panic").pitch, 9);
for (let index = 0; index < 200; index += 1) {
  const chaos = effects.resolvePreset("chaos", {}, "normal");
  assert.ok(chaos.pitch >= -12 && chaos.pitch <= 12);
  assert.ok(chaos.speed >= 0.5 && chaos.speed <= 2);
  assert.ok(!(chaos.robot && chaos.tremolo), "chaos should avoid stacked robot+tremolo");
}

let WorkletProcessor;
const sent = [];
class AudioWorkletProcessorMock {
  constructor() { this.port = { postMessage: (data) => sent.push(data) }; }
}
vm.runInNewContext(workletSource, {
  AudioWorkletProcessor: AudioWorkletProcessorMock,
  Float32Array,
  registerProcessor: (name, processor) => {
    assert.equal(name, "pcm-recorder");
    WorkletProcessor = processor;
  },
});
const processor = new WorkletProcessor();
for (let index = 0; index < 16; index += 1) processor.process([[new Float32Array(128).fill(index / 16)]]);
assert.equal(sent.length, 1);
assert.equal(new Float32Array(sent[0]).length, 2048);

console.log("Oumu-gaeshi tests passed");
