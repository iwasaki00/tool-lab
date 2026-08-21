import assert from "node:assert/strict";
import { clampFrequency, calculateStats, stabilityLabel } from "../js/strobe.js";
import { loadState, makePresetName } from "../js/storage.js";
import { TorchController } from "../js/torch.js";
import fs from "node:fs";

assert.equal(clampFrequency(0), 0.5);
assert.equal(clampFrequency(80), 60);
assert.equal(clampFrequency(12.345), 12.35);

const stats = calculateStats([100, 100, 100], 10);
assert.equal(stats.samples, 3);
assert.equal(stats.average, 100);
assert.equal(stats.frequency, 10);
assert.equal(stats.deviation, 0);
assert.equal(stabilityLabel(stats), "非常に安定");

const memoryStorage = {
  getItem: () => "{broken",
  setItem: () => {}
};
assert.equal(loadState(memoryStorage).frequency, 10);
assert.equal(loadState(memoryStorage).duty, 10);
assert.equal(makePresetName([{ name: "Preset 1" }, { name: "Preset 3" }]), "Preset 2");

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
for (const label of ["ライトを準備", "ストロボ開始", "詳細設定", "診断", "録画開始"]) {
  assert.ok(html.includes(label), `missing UI label: ${label}`);
}
assert.ok(app.includes('document.addEventListener("visibilitychange"'));
assert.ok(app.includes('camera.track.addEventListener("ended"'));

const calls = [];
const mockTrack = {
  applyConstraints: async ({ advanced }) => {
    calls.push(`start:${advanced[0].torch}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
    calls.push(`end:${advanced[0].torch}`);
  },
  getSettings: () => ({ torch: false })
};
const torch = new TorchController(() => mockTrack, () => {});
await Promise.all([torch.set(true), torch.set(false)]);
assert.deepEqual(calls, ["start:true", "end:true", "start:false", "end:false"]);

console.log("Water Strobe tests passed");
