import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const [html, app, manager, objectScene, depthScene, css, readme, rootMenu, renderer, orientation] = await Promise.all([
  "../index.html", "../js/app.js", "../js/scene3d.js", "../js/scenes/modelScene.js",
  "../js/scenes/depthPhotoScene.js", "../style.css", "../README.md", "../../index.html",
  "../js/renderer.js", "../js/orientation.js",
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

const visibleScenes = [...html.matchAll(/data-scene="([^"]+)"/g)].map((match) => match[1]);
const checks = [
  ["Version 1.0.0統一", app.includes('VERSION = "1.0.0"') && html.includes("Version 1.0.0") && readme.includes("Version 1.0.0")],
  ["AQUA正常", visibleScenes.includes("aquarium") && manager.includes("createAquariumScene")],
  ["NEON正常", visibleScenes.includes("neon") && manager.includes("createNeonScene")],
  ["CRYSTAL正常", visibleScenes.includes("crystal") && manager.includes("createCrystalScene")],
  ["OBJECT正常", visibleScenes.includes("model") && html.includes(">OBJECT<") && objectScene.includes('label: "OBJECT"')],
  ["DEPTH非表示", visibleScenes.length === 4 && !visibleScenes.includes("depth")],
  ["Depthコード維持", manager.includes("createDepthPhotoScene") && depthScene.includes("createDepthPhotoScene")],
  ["OBJECT立体サンプル", objectScene.includes("IcosahedronGeometry") && objectScene.includes("TorusGeometry") && objectScene.includes("SphereGeometry")],
  ["OBJECT READY文言", html.includes("OBJECT READY") && !html.includes("MODEL READY")],
  ["OBJECT UIモバイル配置", css.includes(".model-dock { position: static")],
  ["GLB読込", objectScene.includes("async function loadFile") && manager.includes("loadModel(file)")],
  ["GLB Auto Framing", objectScene.includes("function frameContent") && objectScene.includes("getCameraSettings")],
  ["Animation", objectScene.includes("AnimationMixer") && objectScene.includes("setAnimation")],
  ["Horizontal NORMAL", app.includes('horizontalDirection: "normal"')],
  ["Vertical INVERT", app.includes('verticalDirection: "invert"')],
  ["LOOK AT", app.includes('viewMode: "lookAt"')],
  ["View Settings", html.includes("VIEW SETTINGS") && app.includes("applyCalibration")],
  ["Sensor", orientation.includes("DeviceOrientationEvent") && app.includes("orientation.start()")],
  ["Neutral", app.includes("orientation.resetNeutral()") && app.includes("centerImmediately()")],
  ["PC Mouse Simulation", app.includes("enableMouseSimulation") && app.includes("handlePointerMove")],
  ["単一RAF", (renderer.match(/requestAnimationFrame/g) ?? []).length === 2 && !app.includes("requestAnimationFrame") && !manager.includes("requestAnimationFrame")],
  ["Scene切替", manager.includes("async function switchScene") && manager.includes("switchToken")],
  ["Resource解放", manager.includes("disposeObjectTree") && objectScene.includes("disposeModelContent")],
  ["390px responsive", css.includes("@media (max-width: 390px)") && css.includes("overflow-x: hidden")],
  ["横スクロール抑止", css.includes("overflow-x: hidden")],
  ["Landscape案内", html.includes("端末を縦向きに") && app.includes("isLandscapeMobile")],
  ["Portrait復帰", app.includes("updateOrientationLayout") && app.includes("motionRenderer.start()")],
  ["DEBUG", html.includes('id="debug-toggle"') && css.includes("data-depth-debug")],
  ["JavaScript module", html.includes('type="module"')],
  ["README完成整理", readme.includes("実験プロジェクトとしての完成版") && readme.includes("DEPTH PHOTO")],
  ["上位メニュー", rootMenu.includes("Version 1.0.0完成版") && rootMenu.includes("OBJECT")],
  ["禁止拡張なし", !app.includes("OrbitControls") && !manager.includes("EffectComposer")],
];

checks.forEach(([name, passed], index) => {
  assert.equal(passed, true, `${index + 1}. ${name}`);
  console.log(`PASS ${String(index + 1).padStart(2, "0")} ${name}`);
});
console.log(`${checks.length} / ${checks.length} checks passed`);
