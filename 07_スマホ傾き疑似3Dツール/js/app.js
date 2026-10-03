import { OrientationController, SENSOR_STATES } from "./orientation.js";
import { TiltRenderer } from "./renderer.js";
import { createScene3D } from "./scene3d.js";

export const VERSION = "0.3.0";

const viewSettings = {
  invertX: true,
  invertY: true,
};

const elements = {
  root: document.documentElement,
  stage: document.querySelector("#motion-stage"),
  viewport: document.querySelector("#window-viewport"),
  canvas: document.querySelector("#scene-canvas"),
  sceneFallback: document.querySelector("#scene-fallback"),
  webglBadge: document.querySelector("#webgl-badge"),
  sceneName: document.querySelector("#scene-name"),
  sceneSwitcher: document.querySelector("#scene-switcher"),
  rotateOverlay: document.querySelector("#rotate-overlay"),
  start: document.querySelector("#start-motion"),
  reset: document.querySelector("#reset-neutral"),
  state: document.querySelector("#sensor-state"),
  statusDot: document.querySelector("#status-dot"),
  statusMessage: document.querySelector("#status-message"),
  stageHint: document.querySelector("#stage-hint"),
  sensitivity: document.querySelector("#sensitivity"),
  sensitivityValue: document.querySelector("#sensitivity-value"),
  smoothing: document.querySelector("#smoothing"),
  debugToggle: document.querySelector("#debug-toggle"),
  debugPanel: document.querySelector("#debug-panel"),
  invertX: document.querySelector("#invert-x"),
  invertY: document.querySelector("#invert-y"),
  debug: {
    alpha: document.querySelector("#debug-alpha"), beta: document.querySelector("#debug-beta"),
    gamma: document.querySelector("#debug-gamma"), tilt: document.querySelector("#debug-tilt"),
    view: document.querySelector("#debug-view"), invert: document.querySelector("#debug-invert"),
    smooth: document.querySelector("#debug-smooth"), state: document.querySelector("#debug-state"),
    orientation: document.querySelector("#debug-orientation"), fps: document.querySelector("#debug-fps"),
    camera: document.querySelector("#debug-camera"), fov: document.querySelector("#debug-fov"),
    rendererSize: document.querySelector("#debug-renderer-size"),
    devicePixelRatio: document.querySelector("#debug-device-pixel-ratio"),
    effectivePixelRatio: document.querySelector("#debug-effective-pixel-ratio"),
    webgl: document.querySelector("#debug-webgl"),
    currentScene: document.querySelector("#debug-current-scene"), objects: document.querySelector("#debug-objects"),
    triangles: document.querySelector("#debug-triangles"), drawCalls: document.querySelector("#debug-draw-calls"),
    gpuMemory: document.querySelector("#debug-gpu-memory"),
    quality: document.querySelector("#debug-quality"), effects: document.querySelector("#debug-effects"),
    animation: document.querySelector("#debug-animation"),
  },
};

const STATE_LABELS = Object.freeze({
  [SENSOR_STATES.IDLE]: "未開始",
  [SENSOR_STATES.REQUESTING_PERMISSION]: "許可を確認中",
  [SENSOR_STATES.ACTIVE]: "センサー利用可能",
  [SENSOR_STATES.DENIED]: "許可されていません",
  [SENSOR_STATES.UNSUPPORTED]: "センサー非対応",
  [SENSOR_STATES.ERROR]: "エラー",
  [SENSOR_STATES.MOUSE_SIMULATION]: "マウスデモ",
});

const STATE_MESSAGES = Object.freeze({
  [SENSOR_STATES.IDLE]: "モーションを開始するか、マウスでお試しください。",
  [SENSOR_STATES.REQUESTING_PERMISSION]: "ブラウザの確認画面でモーション利用を許可してください。",
  [SENSOR_STATES.ACTIVE]: "端末をゆっくり傾けて、奥行きの変化を確認できます。",
  [SENSOR_STATES.DENIED]: "許可が必要です。ブラウザのサイト設定をご確認ください。",
  [SENSOR_STATES.UNSUPPORTED]: "この環境ではセンサーを利用できません。マウスデモは利用できます。",
  [SENSOR_STATES.ERROR]: "センサーを開始できませんでした。マウスデモは引き続き利用できます。",
  [SENSOR_STATES.MOUSE_SIMULATION]: "マウスを画面内で動かして、傾きをシミュレーションできます。",
});

let lastDebugUpdate = 0;
let latestFrame = null;
let scene3d = null;
let isLandscapeMobile = false;

const orientation = new OrientationController({
  onStateChange: ({ state, detail }) => updateStateUI(state, detail),
});

function getViewSnapshot() {
  const snapshot = orientation.getSnapshot();
  return {
    ...snapshot,
    viewX: viewSettings.invertX ? -snapshot.tiltX : snapshot.tiltX,
    viewY: viewSettings.invertY ? -snapshot.tiltY : snapshot.tiltY,
    invertX: viewSettings.invertX,
    invertY: viewSettings.invertY,
  };
}

const motionRenderer = new TiltRenderer({
  inputProvider: getViewSnapshot,
  onFrame: (frame) => {
    latestFrame = frame;
    scene3d?.render({ cameraViewX: frame.cameraViewX, cameraViewY: frame.cameraViewY, time: frame.time });
    const now = performance.now();
    if (!elements.debugToggle.checked || now - lastDebugUpdate < 100) return;
    lastDebugUpdate = now;
    updateDebug(frame);
  },
});

function updateStateUI(state, detail = "") {
  elements.state.textContent = STATE_LABELS[state] ?? state;
  elements.statusMessage.textContent = detail || STATE_MESSAGES[state] || "";
  const active = state === SENSOR_STATES.ACTIVE || state === SENSOR_STATES.MOUSE_SIMULATION;
  const isError = [SENSOR_STATES.DENIED, SENSOR_STATES.UNSUPPORTED, SENSOR_STATES.ERROR].includes(state);
  elements.statusDot.dataset.active = String(active);
  elements.statusDot.dataset.error = String(isError);
  elements.start.disabled = state === SENSOR_STATES.REQUESTING_PERMISSION;
  elements.start.textContent = state === SENSOR_STATES.ACTIVE ? "モーション動作中" : "◉  モーション開始";
  elements.stageHint.innerHTML = state === SENSOR_STATES.ACTIVE
    ? '<span aria-hidden="true">↗</span> 端末をゆっくり傾ける'
    : '<span aria-hidden="true">↔</span> マウスを動かして試す';
}

function formatAngle(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}°` : "—";
}

function updateDebug(frame = latestFrame) {
  if (!frame) return;
  const snapshot = frame.input;
  elements.debug.alpha.textContent = formatAngle(snapshot.alpha);
  elements.debug.beta.textContent = formatAngle(snapshot.beta);
  elements.debug.gamma.textContent = formatAngle(snapshot.gamma);
  elements.debug.tilt.textContent = `${snapshot.tiltX.toFixed(3)} / ${snapshot.tiltY.toFixed(3)}`;
  elements.debug.view.textContent = `${snapshot.viewX.toFixed(3)} / ${snapshot.viewY.toFixed(3)}`;
  elements.debug.smooth.textContent = `${frame.smoothViewX.toFixed(3)} / ${frame.smoothViewY.toFixed(3)}`;
  elements.debug.invert.textContent = `${snapshot.invertX ? "ON" : "OFF"} / ${snapshot.invertY ? "ON" : "OFF"}`;
  elements.debug.state.textContent = snapshot.state;
  elements.debug.orientation.textContent = `${snapshot.orientation} / ${snapshot.screenAngle}°`;
  elements.debug.fps.textContent = frame.fps ? String(frame.fps) : "計測中";
  elements.root.style.setProperty("--debug-tilt-x", snapshot.tiltX.toFixed(3));
  elements.root.style.setProperty("--debug-tilt-y", snapshot.tiltY.toFixed(3));
  elements.root.style.setProperty("--debug-view-x", snapshot.viewX.toFixed(3));
  elements.root.style.setProperty("--debug-view-y", snapshot.viewY.toFixed(3));
  const metrics = scene3d?.getMetrics();
  if (metrics) {
    const { camera, fov, width, height, devicePixelRatio, effectivePixelRatio } = metrics;
    elements.debug.camera.textContent = `${camera.x.toFixed(2)} / ${camera.y.toFixed(2)} / ${camera.z.toFixed(2)}`;
    elements.debug.fov.textContent = `${fov.toFixed(0)}°`;
    elements.debug.rendererSize.textContent = `${width} × ${height}`;
    elements.debug.devicePixelRatio.textContent = devicePixelRatio.toFixed(2);
    elements.debug.effectivePixelRatio.textContent = effectivePixelRatio.toFixed(2);
    elements.debug.webgl.textContent = metrics.available ? "利用可能" : "非対応";
    elements.debug.currentScene.textContent = metrics.currentScene;
    elements.debug.objects.textContent = String(metrics.objectCount);
    elements.debug.triangles.textContent = metrics.triangles.toLocaleString("ja-JP");
    elements.debug.drawCalls.textContent = String(metrics.drawCalls);
    elements.debug.gpuMemory.textContent = `${metrics.geometries} / ${metrics.textures}`;
    elements.debug.quality.textContent = metrics.quality;
    elements.debug.effects.textContent = `${metrics.fog} / SHADOW ${metrics.shadows ? "ON" : "OFF"}`;
    elements.debug.animation.textContent = metrics.animation;
  }
}

function updateViewSettings() {
  viewSettings.invertX = elements.invertX.checked;
  viewSettings.invertY = elements.invertY.checked;
  motionRenderer.syncToInput();
  updateDebug();
}

function handlePointerMove(event) {
  if (event.pointerType === "touch" || orientation.state === SENSOR_STATES.ACTIVE) return;
  const rect = elements.stage.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  orientation.setMouseTilt(x, y);
}

function updateOrientationLayout() {
  const hasTouch = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  const hasPhoneSizedShortEdge = Math.min(window.innerWidth, window.innerHeight) <= 600;
  isLandscapeMobile = hasTouch && hasPhoneSizedShortEdge && window.innerWidth > window.innerHeight;
  elements.rotateOverlay.hidden = !isLandscapeMobile;
  document.body.classList.toggle("is-landscape-mobile", isLandscapeMobile);
  scene3d?.setPaused(isLandscapeMobile || document.hidden);
  if (isLandscapeMobile || document.hidden) {
    motionRenderer.stop();
  } else {
    scene3d?.resize();
    motionRenderer.start();
  }
}

async function init() {
  document.querySelectorAll("[data-version]").forEach((node) => { node.textContent = `Version ${VERSION}`; });
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) orientation.enableMouseSimulation();
  else updateStateUI(SENSOR_STATES.IDLE);

  elements.start.addEventListener("click", () => orientation.start());
  elements.reset.addEventListener("click", () => {
    orientation.resetNeutral();
    motionRenderer.centerImmediately();
    elements.statusMessage.textContent = orientation.state === SENSOR_STATES.ACTIVE
      ? "現在の端末姿勢を中央位置に設定しました。"
      : "表示を中央位置に戻しました。";
  });
  elements.stage.addEventListener("pointermove", handlePointerMove, { passive: true });
  elements.stage.addEventListener("pointerleave", () => {
    if (orientation.state !== SENSOR_STATES.ACTIVE) orientation.setMouseTilt(0, 0);
  }, { passive: true });
  elements.sensitivity.addEventListener("input", (event) => {
    motionRenderer.setSensitivity(event.target.value);
    elements.sensitivityValue.value = `${event.target.value}%`;
  });
  elements.smoothing.addEventListener("change", (event) => motionRenderer.setSmoothing(event.target.value));
  elements.debugToggle.addEventListener("change", () => {
    elements.debugPanel.hidden = !elements.debugToggle.checked;
    scene3d?.setDebugVisible(elements.debugToggle.checked);
    if (elements.debugToggle.checked) updateDebug();
  });
  elements.sceneSwitcher.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-scene]");
    if (!button || !scene3d?.available) return;
    elements.sceneSwitcher.querySelectorAll("button[data-scene]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    await scene3d.switchScene(button.dataset.scene);
    updateDebug();
  });
  elements.invertX.addEventListener("change", updateViewSettings);
  elements.invertY.addEventListener("change", updateViewSettings);
  document.addEventListener("visibilitychange", () => {
    updateOrientationLayout();
  });
  window.addEventListener("resize", updateOrientationLayout, { passive: true });
  window.screen?.orientation?.addEventListener?.("change", updateOrientationLayout);

  motionRenderer.setSensitivity(elements.sensitivity.value);
  motionRenderer.setSmoothing(elements.smoothing.value);
  updateViewSettings();
  scene3d = await createScene3D({
    canvas: elements.canvas,
    container: elements.viewport,
    onStatus: ({ available, message }) => {
      elements.webglBadge.textContent = available ? "WEBGL ACTIVE" : "WEBGL UNAVAILABLE";
      elements.sceneFallback.hidden = available;
      elements.debug.webgl.textContent = available ? message : `非対応: ${message}`;
    },
    onSceneChange: ({ label }) => {
      elements.sceneName.textContent = label;
      elements.debug.currentScene.textContent = label;
    },
  });
  scene3d.setDebugVisible(elements.debugToggle.checked);
  updateOrientationLayout();
}

init();
