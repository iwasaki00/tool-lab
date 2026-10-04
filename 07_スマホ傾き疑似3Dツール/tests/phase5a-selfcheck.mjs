import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const [html, app, manager, depth, css, readme, rootMenu] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../js/scene3d.js", import.meta.url), "utf8"),
  readFile(new URL("../js/scenes/depthPhotoScene.js", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../../index.html", import.meta.url), "utf8"),
]);

const checks = [
  ["Version 0.5.0", app.includes('VERSION = "0.5.0"') && html.includes("Version 0.5.0")],
  ["Phase 5A hero", html.includes("PHASE 05A / DEPTH PHOTO CORE")],
  ["5 scene buttons", (html.match(/data-scene=/g) ?? []).length === 5],
  ["depth scene factory", manager.includes("depth: createDepthPhotoScene")],
  ["photo input", html.includes('id="photo-file-input"')],
  ["depth input", html.includes('id="depth-file-input"')],
  ["image accept", (html.match(/accept="image\/\*"/g) ?? []).length === 2],
  ["FLAT mode", html.includes('value="flat"') && depth.includes('"flat"')],
  ["LAYERS mode", html.includes('value="layers"') && depth.includes('"layers"')],
  ["MESH mode", html.includes('value="mesh"') && depth.includes('"mesh"')],
  ["strength 0-300", html.includes('id="depth-strength" type="range" min="0" max="300"')],
  ["invert", html.includes('name="depth-invert"')],
  ["smooth levels", ["off","low","medium","high"].every((value) => html.includes(`value="${value}"`))],
  ["quality levels", ["low","standard","high"].every((value) => depth.includes(`${value}:`))],
  ["vertex cap", depth.includes("MAX_VERTICES = 40000")],
  ["depth brightness", depth.includes("0.2126") && depth.includes("0.7152")],
  ["depth center formula", depth.includes("(depth - 0.5) * amplitude")],
  ["layer quantization", depth.includes("Math.round(depth * 7) / 7")],
  ["neighbor smooth", depth.includes("blurDepth")],
  ["max depth step", depth.includes("clampDepthSteps")],
  ["edge stretch", depth.includes("remapUvsForEdgeStretch")],
  ["background extension", depth.includes('backgroundMesh.name = "EDGE_EXTENSION"')],
  ["photo camera clamp", depth.includes("inputLimitX: 1.45") && depth.includes("inputLimitY: 1.35")],
  ["camera clamp applied", manager.includes("cameraInputX") && manager.includes("cameraInputY")],
  ["sample canvas", depth.includes("createSamplePhoto") && depth.includes("createSampleDepth")],
  ["EXIF-aware decode", depth.includes('imageOrientation: "from-image"')],
  ["Image fallback", depth.includes("decodeWithImageElement") && depth.includes("revokeObjectURL")],
  ["aspect mismatch warning", depth.includes("aspectMismatch") && depth.includes("再サンプリング")],
  ["image size cap", depth.includes("const maximum = 2048")],
  ["depth storage key", app.includes("tilt3d:depth-photo:v1")],
  ["settings-only persistence", app.includes("const { mode, strength, invert, smooth, quality }")],
  ["preview UI", html.includes('id="photo-preview"') && html.includes('id="depth-preview"')],
  ["debug telemetry", html.includes('id="debug-list"') && app.includes('"depth-stats"')],
  ["responsive 5-column switcher", css.includes("repeat(5, 1fr)")],
  ["root menu updated", rootMenu.includes("写真とDepth Map") && rootMenu.includes("5つの3Dシーン")],
  ["README Phase 5B", readme.includes("Phase 5B") && readme.includes("AUTO DEPTH")],
];

checks.forEach(([name, passed], index) => {
  assert.equal(passed, true, `${index + 1}. ${name}`);
  console.log(`PASS ${String(index + 1).padStart(2, "0")} ${name}`);
});
console.log(`${checks.length} / ${checks.length} checks passed`);
