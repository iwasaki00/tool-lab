import { OrientationController, SENSOR_STATES } from "./orientation.js";
import { TiltRenderer, FINAL_INPUT_LIMIT } from "./renderer.js";
import { createScene3D } from "./scene3d.js?v=1000";

export const VERSION = "1.0.0";

const STORAGE_KEY = "tilt3d:view-calibration:v1";
const STORAGE_VERSION = 1;
const DEPTH_STORAGE_KEY = "tilt3d:depth-photo:v1";
const DEFAULT_DEPTH_SETTINGS = Object.freeze({ mode: "mesh", strength: 0.9, invert: false, smooth: "medium", quality: "standard", maxDepthStep: true });
const DIRECTIONS = ["normal", "invert", "off"];
const VIEW_MODES = ["window", "lookAt"];
const DEFAULT_CALIBRATION = Object.freeze({
  masterSensitivity: 1,
  horizontalGain: 1,
  verticalGain: 1,
  horizontalDirection: "normal",
  verticalDirection: "invert",
  viewMode: "lookAt",
  fov: 42,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const calibration = loadCalibration();
const depthSettings = loadDepthSettings();

const debugFields = [
  ["alpha","alpha"],["beta","beta"],["gamma","gamma"],["tilt","tilt X / Y"],["view","view X / Y"],["smooth","smoothed X / Y"],["final","final input X / Y"],["directions","direction X / Y"],
  ["gains","master / gain X / Y"],["view-mode","view mode"],["state","sensor state"],["orientation","orientation"],["fps","FPS"],["camera","camera X / Y / Z"],["fov","FOV"],["renderer-size","renderer W × H"],
  ["device-pixel-ratio","device pixel ratio"],["effective-pixel-ratio","effective pixel ratio"],["webgl","WebGL"],["current-scene","current scene"],["objects","objects"],["triangles","triangles"],["draw-calls","draw calls"],["gpu-memory","GPU geometry / texture"],["quality","quality"],["effects","fog / shadow"],["animation","animation"],
  ["model-loaded","model loaded"],["model-name","model name"],["model-dimensions","bounding box X / Y / Z"],["model-center","model center X / Y / Z"],["model-scale","model scale"],["model-distance","base camera distance"],["model-target","target X / Y / Z"],["model-geometry","model mesh / triangle"],["model-materials","model materials"],["model-animation-count","animation count"],["model-current-animation","current animation"],["model-mixer","mixer state"],["model-loader","loader state / time"],["model-error","model error"],
  ["photo-size","photo W × H"],["depth-size","depth W × H"],["depth-source","photo / depth source"],["depth-mode","depth mode"],["depth-strength","strength / invert"],["depth-quality","smooth / quality"],["depth-stats","depth min / avg / max"],["depth-mesh","mesh C × R / vertices"],["depth-triangles","depth triangles"],["depth-camera","photo camera range"],["depth-risk","disocclusion risk"],["depth-process","process time / state"],["depth-error","depth error"],
];
document.querySelector("#debug-list").innerHTML = debugFields.map(([id,label]) => `<div${id.startsWith("depth-") || id === "photo-size" ? ' data-depth-debug' : ''}><dt>${label}</dt><dd id="debug-${id}">—</dd></div>`).join("");

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
  debugToggle: document.querySelector("#debug-toggle"),
  debugPanel: document.querySelector("#debug-panel"),
  calibrationLayer: document.querySelector("#calibration-layer"),
  calibrationOpen: document.querySelector("#view-settings-open"),
  calibrationClose: document.querySelector("#view-settings-close"),
  calibrationBackdrop: document.querySelector("#calibration-backdrop"),
  calibrationSummary: document.querySelector("#view-settings-summary"),
  resetViewSettings: document.querySelector("#reset-view-settings"),
  modelDock: document.querySelector("#model-dock"),
  modelFileInput: document.querySelector("#model-file-input"),
  modelSettingsOpen: document.querySelector("#model-settings-open"),
  modelSettingsLayer: document.querySelector("#model-settings-layer"),
  modelSettingsClose: document.querySelector("#model-settings-close"),
  modelSettingsBackdrop: document.querySelector("#model-settings-backdrop"),
  modelLoaderState: document.querySelector("#model-loader-state"),
  modelDockName: document.querySelector("#model-dock-name"),
  modelSettingsState: document.querySelector("#model-settings-state"),
  modelSettingsName: document.querySelector("#model-settings-name"),
  modelSettingsMessage: document.querySelector("#model-settings-message"),
  modelAnimationCount: document.querySelector("#model-animation-count"),
  modelAnimationSelect: document.querySelector("#model-animation-select"),
  modelAnimationToggle: document.querySelector("#model-animation-toggle"),
  modelPerformanceWarning: document.querySelector("#model-performance-warning"),
  modelInfo: {
    dimensions: document.querySelector("#model-info-dimensions"), meshes: document.querySelector("#model-info-meshes"),
    triangles: document.querySelector("#model-info-triangles"), materials: document.querySelector("#model-info-materials"),
    scale: document.querySelector("#model-info-scale"), distance: document.querySelector("#model-info-distance"),
  },
  depthDock: document.querySelector("#depth-dock"),
  photoFileInput: document.querySelector("#photo-file-input"), depthFileInput: document.querySelector("#depth-file-input"),
  depthSettingsOpen: document.querySelector("#depth-settings-open"), depthSettingsLayer: document.querySelector("#depth-settings-layer"),
  depthSettingsClose: document.querySelector("#depth-settings-close"), depthSettingsBackdrop: document.querySelector("#depth-settings-backdrop"),
  depthLoaderState: document.querySelector("#depth-loader-state"), depthDockName: document.querySelector("#depth-dock-name"),
  depthSettingsState: document.querySelector("#depth-settings-state"), depthSettingsName: document.querySelector("#depth-settings-name"), depthSettingsMessage: document.querySelector("#depth-settings-message"),
  photoPreview: document.querySelector("#photo-preview"), depthPreview: document.querySelector("#depth-preview"),
  depthStrength: document.querySelector("#depth-strength"), depthStrengthValue: document.querySelector("#depth-strength-value"),
  depthSmooth: document.querySelector("#depth-smooth"), depthQuality: document.querySelector("#depth-quality"), depthMaxStep: document.querySelector("#depth-max-step"),
  depthWarning: document.querySelector("#depth-warning"), depthError: document.querySelector("#depth-error"), resetDepthSettings: document.querySelector("#reset-depth-settings"),
  sensitivity: document.querySelector("#sensitivity"),
  sensitivityValue: document.querySelector("#sensitivity-value"),
  horizontalGain: document.querySelector("#horizontal-gain"),
  horizontalGainValue: document.querySelector("#horizontal-gain-value"),
  verticalGain: document.querySelector("#vertical-gain"),
  verticalGainValue: document.querySelector("#vertical-gain-value"),
  fov: document.querySelector("#fov"),
  fovValue: document.querySelector("#fov-value"),
  smoothing: document.querySelector("#smoothing"),
  debug: {
    alpha: document.querySelector("#debug-alpha"), beta: document.querySelector("#debug-beta"),
    gamma: document.querySelector("#debug-gamma"), tilt: document.querySelector("#debug-tilt"),
    view: document.querySelector("#debug-view"), smooth: document.querySelector("#debug-smooth"),
    final: document.querySelector("#debug-final"), directions: document.querySelector("#debug-directions"),
    gains: document.querySelector("#debug-gains"), viewMode: document.querySelector("#debug-view-mode"),
    state: document.querySelector("#debug-state"), orientation: document.querySelector("#debug-orientation"),
    fps: document.querySelector("#debug-fps"), camera: document.querySelector("#debug-camera"),
    fov: document.querySelector("#debug-fov"), rendererSize: document.querySelector("#debug-renderer-size"),
    devicePixelRatio: document.querySelector("#debug-device-pixel-ratio"),
    effectivePixelRatio: document.querySelector("#debug-effective-pixel-ratio"),
    webgl: document.querySelector("#debug-webgl"), currentScene: document.querySelector("#debug-current-scene"),
    objects: document.querySelector("#debug-objects"), triangles: document.querySelector("#debug-triangles"),
    drawCalls: document.querySelector("#debug-draw-calls"), gpuMemory: document.querySelector("#debug-gpu-memory"),
    quality: document.querySelector("#debug-quality"), effects: document.querySelector("#debug-effects"),
    animation: document.querySelector("#debug-animation"),
    modelLoaded: document.querySelector("#debug-model-loaded"), modelName: document.querySelector("#debug-model-name"),
    modelDimensions: document.querySelector("#debug-model-dimensions"), modelCenter: document.querySelector("#debug-model-center"),
    modelScale: document.querySelector("#debug-model-scale"), modelDistance: document.querySelector("#debug-model-distance"),
    modelTarget: document.querySelector("#debug-model-target"), modelGeometry: document.querySelector("#debug-model-geometry"),
    modelMaterials: document.querySelector("#debug-model-materials"), modelAnimationCount: document.querySelector("#debug-model-animation-count"),
    modelCurrentAnimation: document.querySelector("#debug-model-current-animation"), modelMixer: document.querySelector("#debug-model-mixer"),
    modelLoader: document.querySelector("#debug-model-loader"), modelError: document.querySelector("#debug-model-error"),
    photoSize: document.querySelector("#debug-photo-size"), depthSize: document.querySelector("#debug-depth-size"), depthSource: document.querySelector("#debug-depth-source"), depthMode: document.querySelector("#debug-depth-mode"), depthStrength: document.querySelector("#debug-depth-strength"), depthQuality: document.querySelector("#debug-depth-quality"), depthStats: document.querySelector("#debug-depth-stats"), depthMesh: document.querySelector("#debug-depth-mesh"), depthTriangles: document.querySelector("#debug-depth-triangles"), depthCamera: document.querySelector("#debug-depth-camera"), depthRisk: document.querySelector("#debug-depth-risk"), depthProcess: document.querySelector("#debug-depth-process"), depthError: document.querySelector("#debug-depth-error"),
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
let calibrationOpener = null;
let modelSettingsOpener = null;
let depthSettingsOpener = null;
let currentSceneId = "aquarium";
let latestModelInfo = null;
let latestDepthInfo = null;

const orientation = new OrientationController({
  onStateChange: ({ state, detail }) => updateStateUI(state, detail),
});

function applyAxisDirection(value, direction) {
  if (direction === "off") return 0;
  return direction === "invert" ? -value : value;
}

function getViewSnapshot() {
  const snapshot = orientation.getSnapshot();
  return {
    ...snapshot,
    viewX: applyAxisDirection(snapshot.tiltX, calibration.horizontalDirection),
    viewY: applyAxisDirection(snapshot.tiltY, calibration.verticalDirection),
    horizontalDirection: calibration.horizontalDirection,
    verticalDirection: calibration.verticalDirection,
  };
}

const motionRenderer = new TiltRenderer({
  inputProvider: getViewSnapshot,
  onFrame: (frame) => {
    latestFrame = frame;
    scene3d?.render({ finalX: frame.finalX, finalY: frame.finalY, time: frame.time });
    const now = performance.now();
    if (!elements.debugToggle.checked || now - lastDebugUpdate < 100) return;
    lastDebugUpdate = now;
    updateDebug(frame);
  },
});

function numberOrDefault(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

function loadCalibration() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!stored || stored.storageVersion !== STORAGE_VERSION) return { ...DEFAULT_CALIBRATION };
    return {
      masterSensitivity: numberOrDefault(stored.masterSensitivity, 0.25, 4, DEFAULT_CALIBRATION.masterSensitivity),
      horizontalGain: numberOrDefault(stored.horizontalGain, 0, 3, DEFAULT_CALIBRATION.horizontalGain),
      verticalGain: numberOrDefault(stored.verticalGain, 0, 3, DEFAULT_CALIBRATION.verticalGain),
      horizontalDirection: DIRECTIONS.includes(stored.horizontalDirection) ? stored.horizontalDirection : DEFAULT_CALIBRATION.horizontalDirection,
      verticalDirection: DIRECTIONS.includes(stored.verticalDirection) ? stored.verticalDirection : DEFAULT_CALIBRATION.verticalDirection,
      viewMode: VIEW_MODES.includes(stored.viewMode) ? stored.viewMode : DEFAULT_CALIBRATION.viewMode,
      fov: numberOrDefault(stored.fov, 35, 80, DEFAULT_CALIBRATION.fov),
    };
  } catch {
    return { ...DEFAULT_CALIBRATION };
  }
}

function loadDepthSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEPTH_STORAGE_KEY) ?? "null");
    if (!stored) return { ...DEFAULT_DEPTH_SETTINGS };
    return {
      mode: ["flat", "layers", "mesh"].includes(stored.mode) ? stored.mode : DEFAULT_DEPTH_SETTINGS.mode,
      strength: numberOrDefault(stored.strength, 0, 3, DEFAULT_DEPTH_SETTINGS.strength),
      invert: Boolean(stored.invert),
      smooth: ["off", "low", "medium", "high"].includes(stored.smooth) ? stored.smooth : DEFAULT_DEPTH_SETTINGS.smooth,
      quality: ["low", "standard", "high"].includes(stored.quality) ? stored.quality : DEFAULT_DEPTH_SETTINGS.quality,
      maxDepthStep: DEFAULT_DEPTH_SETTINGS.maxDepthStep,
    };
  } catch { return { ...DEFAULT_DEPTH_SETTINGS }; }
}

function saveDepthSettings() {
  const { mode, strength, invert, smooth, quality } = depthSettings;
  try { localStorage.setItem(DEPTH_STORAGE_KEY, JSON.stringify({ mode, strength, invert, smooth, quality })); } catch { /* Current session remains usable. */ }
}

function saveCalibration() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ storageVersion: STORAGE_VERSION, ...calibration }));
  } catch {
    // Storage may be disabled; calibration still works for the current session.
  }
}

function checkedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function setCheckedValue(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function renderCalibrationUI() {
  elements.sensitivity.value = String(Math.round(calibration.masterSensitivity * 100));
  elements.horizontalGain.value = String(Math.round(calibration.horizontalGain * 100));
  elements.verticalGain.value = String(Math.round(calibration.verticalGain * 100));
  elements.fov.value = String(Math.round(calibration.fov));
  elements.sensitivityValue.value = `${elements.sensitivity.value}%`;
  elements.horizontalGainValue.value = `${elements.horizontalGain.value}%`;
  elements.verticalGainValue.value = `${elements.verticalGain.value}%`;
  elements.fovValue.value = `${elements.fov.value}°`;
  setCheckedValue("horizontal-direction", calibration.horizontalDirection);
  setCheckedValue("vertical-direction", calibration.verticalDirection);
  setCheckedValue("view-mode", calibration.viewMode);
  elements.calibrationSummary.textContent = `${calibration.viewMode === "window" ? "WINDOW" : "LOOK AT"} · ${elements.sensitivity.value}%`;
}

function applyCalibration({ syncInput = false, persist = true } = {}) {
  motionRenderer.setCalibration({
    masterSensitivity: calibration.masterSensitivity,
    horizontalGain: calibration.horizontalGain,
    verticalGain: calibration.verticalGain,
  });
  scene3d?.setViewCalibration({ viewMode: calibration.viewMode, fov: calibration.fov });
  if (syncInput) motionRenderer.syncToInput();
  renderCalibrationUI();
  if (persist) saveCalibration();
  updateDebug();
}

function readCalibrationUI() {
  calibration.masterSensitivity = numberOrDefault(Number(elements.sensitivity.value) / 100, 0.25, 4, DEFAULT_CALIBRATION.masterSensitivity);
  calibration.horizontalGain = numberOrDefault(Number(elements.horizontalGain.value) / 100, 0, 3, DEFAULT_CALIBRATION.horizontalGain);
  calibration.verticalGain = numberOrDefault(Number(elements.verticalGain.value) / 100, 0, 3, DEFAULT_CALIBRATION.verticalGain);
  calibration.horizontalDirection = DIRECTIONS.includes(checkedValue("horizontal-direction")) ? checkedValue("horizontal-direction") : DEFAULT_CALIBRATION.horizontalDirection;
  calibration.verticalDirection = DIRECTIONS.includes(checkedValue("vertical-direction")) ? checkedValue("vertical-direction") : DEFAULT_CALIBRATION.verticalDirection;
  calibration.viewMode = VIEW_MODES.includes(checkedValue("view-mode")) ? checkedValue("view-mode") : DEFAULT_CALIBRATION.viewMode;
  calibration.fov = numberOrDefault(elements.fov.value, 35, 80, DEFAULT_CALIBRATION.fov);
}

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

function formatVector(vector, digits = 2) {
  if (!vector) return "—";
  return `${Number(vector.x).toFixed(digits)} / ${Number(vector.y).toFixed(digits)} / ${Number(vector.z).toFixed(digits)}`;
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
  elements.debug.final.textContent = `${frame.finalX.toFixed(3)} / ${frame.finalY.toFixed(3)}`;
  elements.debug.directions.textContent = `${calibration.horizontalDirection.toUpperCase()} / ${calibration.verticalDirection.toUpperCase()}`;
  elements.debug.gains.textContent = `${Math.round(calibration.masterSensitivity * 100)}% / ${Math.round(calibration.horizontalGain * 100)}% / ${Math.round(calibration.verticalGain * 100)}%`;
  elements.debug.viewMode.textContent = calibration.viewMode === "window" ? "WINDOW" : "LOOK AT";
  elements.debug.state.textContent = snapshot.state;
  elements.debug.orientation.textContent = `${snapshot.orientation} / ${snapshot.screenAngle}°`;
  elements.debug.fps.textContent = frame.fps ? String(frame.fps) : "計測中";
  elements.root.style.setProperty("--debug-tilt-x", snapshot.tiltX.toFixed(3));
  elements.root.style.setProperty("--debug-tilt-y", snapshot.tiltY.toFixed(3));
  elements.root.style.setProperty("--debug-camera-x", clamp(frame.finalX / FINAL_INPUT_LIMIT, -1, 1).toFixed(3));
  elements.root.style.setProperty("--debug-camera-y", clamp(frame.finalY / FINAL_INPUT_LIMIT, -1, 1).toFixed(3));
  const metrics = scene3d?.getMetrics();
  if (!metrics) return;
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
  const model = metrics.model;
  elements.debug.modelLoaded.textContent = model ? (model.loaded ? "YES" : "PLACEHOLDER") : "—";
  elements.debug.modelName.textContent = model?.name ?? "—";
  elements.debug.modelDimensions.textContent = model ? formatVector(model.dimensions) : "—";
  elements.debug.modelCenter.textContent = model ? formatVector(model.center) : "—";
  elements.debug.modelScale.textContent = model ? Number(model.scale).toFixed(4) : "—";
  elements.debug.modelDistance.textContent = model ? Number(model.baseCameraDistance).toFixed(2) : "—";
  elements.debug.modelTarget.textContent = model ? formatVector(model.target) : "—";
  elements.debug.modelGeometry.textContent = model ? `${model.meshCount} / ${model.triangleCount.toLocaleString("ja-JP")}` : "—";
  elements.debug.modelMaterials.textContent = model ? String(model.materialCount) : "—";
  elements.debug.modelAnimationCount.textContent = model ? String(model.animationCount) : "—";
  elements.debug.modelCurrentAnimation.textContent = model?.currentAnimation ?? "—";
  elements.debug.modelMixer.textContent = model?.mixerState ?? "—";
  elements.debug.modelLoader.textContent = model ? `${model.loaderState} / ${Math.round(model.loadTime)}ms` : "—";
  elements.debug.modelError.textContent = model?.errorCode || "—";
  const depth = metrics.depthPhoto;
  elements.debug.photoSize.textContent = depth ? `${depth.photoWidth} × ${depth.photoHeight}` : "—";
  elements.debug.depthSize.textContent = depth ? `${depth.depthWidth} × ${depth.depthHeight}` : "—";
  elements.debug.depthSource.textContent = depth ? `${depth.photoSource} / ${depth.depthSource}` : "—";
  elements.debug.depthMode.textContent = depth?.mode?.toUpperCase() ?? "—";
  elements.debug.depthStrength.textContent = depth ? `${Math.round(depth.strength * 100)}% / ${depth.invert ? "INVERT" : "NORMAL"}` : "—";
  elements.debug.depthQuality.textContent = depth ? `${depth.smooth.toUpperCase()} / ${depth.quality.toUpperCase()}` : "—";
  elements.debug.depthStats.textContent = depth ? `${depth.depthMin.toFixed(3)} / ${depth.depthAverage.toFixed(3)} / ${depth.depthMax.toFixed(3)}` : "—";
  elements.debug.depthMesh.textContent = depth ? `${depth.columns} × ${depth.rows} / ${depth.vertices.toLocaleString("ja-JP")}` : "—";
  elements.debug.depthTriangles.textContent = depth ? depth.triangles.toLocaleString("ja-JP") : "—";
  elements.debug.depthCamera.textContent = depth ? `${Number(depth.baseCameraDistance || 0).toFixed(2)} / ±${Number(depth.cameraRangeX || 0).toFixed(2)}, ±${Number(depth.cameraRangeY || 0).toFixed(2)}` : "—";
  elements.debug.depthRisk.textContent = depth?.risk ?? "—";
  elements.debug.depthProcess.textContent = depth ? `${Math.round(depth.processingTime)}ms / ${depth.status}` : "—";
  elements.debug.depthError.textContent = depth?.errorCode || "—";
}

function handlePointerMove(event) {
  if (event.pointerType === "touch" || orientation.state === SENSOR_STATES.ACTIVE) return;
  const rect = elements.stage.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  orientation.setMouseTilt(x, y);
}

function openCalibration() {
  calibrationOpener = document.activeElement;
  elements.calibrationLayer.hidden = false;
  document.body.classList.add("has-calibration");
  elements.calibrationClose.focus();
}

function closeCalibration() {
  elements.calibrationLayer.hidden = true;
  document.body.classList.remove("has-calibration");
  calibrationOpener?.focus?.();
}

function openModelSettings() {
  modelSettingsOpener = document.activeElement;
  updateModelUI(scene3d?.getModelInfo());
  elements.modelSettingsLayer.hidden = false;
  document.body.classList.add("has-calibration");
  elements.modelSettingsClose.focus();
}

function closeModelSettings() {
  elements.modelSettingsLayer.hidden = true;
  document.body.classList.remove("has-calibration");
  modelSettingsOpener?.focus?.();
}

function openDepthSettings() {
  depthSettingsOpener = document.activeElement;
  renderDepthSettingsUI();
  elements.depthSettingsLayer.hidden = false;
  document.body.classList.add("has-calibration");
  elements.depthSettingsClose.focus();
}

function closeDepthSettings() {
  elements.depthSettingsLayer.hidden = true;
  document.body.classList.remove("has-calibration");
  depthSettingsOpener?.focus?.();
}

function renderDepthSettingsUI() {
  setCheckedValue("depth-mode", depthSettings.mode);
  setCheckedValue("depth-invert", depthSettings.invert ? "on" : "off");
  elements.depthStrength.value = String(Math.round(depthSettings.strength * 100));
  elements.depthStrengthValue.value = `${elements.depthStrength.value}%`;
  elements.depthSmooth.value = depthSettings.smooth;
  elements.depthQuality.value = depthSettings.quality;
  elements.depthMaxStep.checked = depthSettings.maxDepthStep;
}

function readDepthSettingsUI() {
  depthSettings.mode = checkedValue("depth-mode") || DEFAULT_DEPTH_SETTINGS.mode;
  depthSettings.strength = numberOrDefault(Number(elements.depthStrength.value) / 100, 0, 3, DEFAULT_DEPTH_SETTINGS.strength);
  depthSettings.invert = checkedValue("depth-invert") === "on";
  depthSettings.smooth = elements.depthSmooth.value;
  depthSettings.quality = elements.depthQuality.value;
  depthSettings.maxDepthStep = elements.depthMaxStep.checked;
}

function applyDepthSettings() {
  renderDepthSettingsUI();
  saveDepthSettings();
  scene3d?.setDepthPhotoSettings(depthSettings);
}

function updateDepthUI(info) {
  if (!info) return;
  latestDepthInfo = { ...latestDepthInfo, ...info };
  const depth = latestDepthInfo;
  elements.depthLoaderState.textContent = depth.status;
  elements.depthDockName.textContent = `${depth.mode?.toUpperCase() ?? "MESH"} · ${Math.round((depth.strength ?? .9) * 100)}%`;
  elements.depthSettingsState.textContent = depth.status;
  elements.depthSettingsName.textContent = `${depth.photoName} + ${depth.depthName}`;
  elements.depthSettingsMessage.textContent = depth.errorDetail || depth.mismatch || "白ほど手前、黒ほど奥として処理します。";
  if (depth.photoPreview) elements.photoPreview.src = depth.photoPreview;
  if (depth.depthPreview) elements.depthPreview.src = depth.depthPreview;
  elements.depthWarning.hidden = !depth.mismatch;
  elements.depthWarning.textContent = depth.mismatch || "";
  elements.depthError.hidden = !depth.errorDetail;
  elements.depthError.textContent = depth.errorDetail || "";
  updateDebug();
}

function updateModelUI(info) {
  if (!info) return;
  latestModelInfo = { ...latestModelInfo, ...info };
  const model = latestModelInfo;
  elements.modelLoaderState.textContent = model.loaderState;
  elements.modelDockName.textContent = model.name;
  elements.modelSettingsState.textContent = model.loaderState;
  elements.modelSettingsName.textContent = model.name;
  if (model.loaderState === "LOADING OBJECT...") {
    elements.modelSettingsMessage.textContent = "3Dオブジェクトをブラウザ内で読み込んでいます。";
  } else if (model.loaderState === "OBJECT LOAD ERROR") {
    elements.modelSettingsMessage.textContent = model.errorDetail || "3Dオブジェクトを読み込めませんでした。";
  } else if (model.loaded) {
    elements.modelSettingsMessage.textContent = "中央配置とカメラフレーミングが完了しました。";
  } else {
    elements.modelSettingsMessage.textContent = "端末を傾けて、隠れた側面や上面を覗いてみましょう。";
  }

  elements.modelInfo.dimensions.textContent = formatVector(model.dimensions);
  elements.modelInfo.meshes.textContent = String(model.meshCount ?? 0);
  elements.modelInfo.triangles.textContent = Number(model.triangleCount ?? 0).toLocaleString("ja-JP");
  elements.modelInfo.materials.textContent = String(model.materialCount ?? 0);
  elements.modelInfo.scale.textContent = Number(model.scale ?? 1).toFixed(4);
  elements.modelInfo.distance.textContent = Number(model.baseCameraDistance ?? 0).toFixed(2);
  elements.modelPerformanceWarning.hidden = !model.warning;
  elements.modelPerformanceWarning.textContent = model.warning || "";

  const animations = model.animations ?? [];
  const optionSignature = animations.map((item) => `${item.index}:${item.name}`).join("|");
  if (elements.modelAnimationSelect.dataset.signature !== optionSignature) {
    elements.modelAnimationSelect.replaceChildren();
    if (!animations.length) {
      elements.modelAnimationSelect.add(new Option("NO ANIMATION", ""));
    } else {
      animations.forEach((item) => elements.modelAnimationSelect.add(new Option(item.name, String(item.index))));
    }
    elements.modelAnimationSelect.dataset.signature = optionSignature;
  }
  elements.modelAnimationCount.textContent = `${model.animationCount ?? 0} CLIPS`;
  elements.modelAnimationSelect.disabled = !animations.length;
  elements.modelAnimationToggle.disabled = !animations.length;
  const activeIndex = animations.find((item) => item.name === model.currentAnimation)?.index;
  if (activeIndex !== undefined) elements.modelAnimationSelect.value = String(activeIndex);
  elements.modelAnimationToggle.textContent = model.mixerState === "PLAYING" ? "PAUSE" : "PLAY";
  updateDebug();
}

function updateOrientationLayout() {
  const hasTouch = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  const hasPhoneSizedShortEdge = Math.min(window.innerWidth, window.innerHeight) <= 600;
  isLandscapeMobile = hasTouch && hasPhoneSizedShortEdge && window.innerWidth > window.innerHeight;
  elements.rotateOverlay.hidden = !isLandscapeMobile;
  document.body.classList.toggle("is-landscape-mobile", isLandscapeMobile);
  scene3d?.setPaused(isLandscapeMobile || document.hidden);
  if (isLandscapeMobile || document.hidden) motionRenderer.stop();
  else {
    scene3d?.resize();
    motionRenderer.start();
  }
}

async function init() {
  document.querySelectorAll("[data-version]").forEach((node) => { node.textContent = `Version ${VERSION}`; });
  renderCalibrationUI();
  motionRenderer.setSmoothing(elements.smoothing.value);
  applyCalibration({ syncInput: true, persist: false });

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

  elements.calibrationOpen.addEventListener("click", openCalibration);
  elements.calibrationClose.addEventListener("click", closeCalibration);
  elements.calibrationBackdrop.addEventListener("click", closeCalibration);
  elements.calibrationLayer.addEventListener("input", (event) => {
    if (!event.target.matches('input[type="range"]')) return;
    readCalibrationUI();
    applyCalibration();
  });
  elements.calibrationLayer.addEventListener("change", (event) => {
    if (!event.target.matches('input[type="radio"]')) return;
    readCalibrationUI();
    applyCalibration({ syncInput: true });
  });
  elements.smoothing.addEventListener("change", (event) => motionRenderer.setSmoothing(event.target.value));
  elements.resetViewSettings.addEventListener("click", () => {
    Object.assign(calibration, DEFAULT_CALIBRATION);
    applyCalibration({ syncInput: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.calibrationLayer.hidden) closeCalibration();
    if (event.key === "Escape" && !elements.modelSettingsLayer.hidden) closeModelSettings();
    if (event.key === "Escape" && !elements.depthSettingsLayer.hidden) closeDepthSettings();
  });

  elements.modelSettingsOpen.addEventListener("click", openModelSettings);
  elements.modelSettingsClose.addEventListener("click", closeModelSettings);
  elements.modelSettingsBackdrop.addEventListener("click", closeModelSettings);
  elements.modelFileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) return;
    try {
      await scene3d.loadModel(file);
    } catch {
      // The MODEL VIEWER remains usable and reports a friendly error through onModelUpdate.
    } finally {
      event.target.value = "";
    }
  });
  elements.modelSettingsLayer.addEventListener("change", (event) => {
    if (event.target.matches('input[name="model-lighting"]')) scene3d?.setModelLighting(event.target.value);
    if (event.target.matches('input[name="model-background"]')) scene3d?.setModelBackground(event.target.value);
  });
  elements.modelAnimationSelect.addEventListener("change", (event) => scene3d?.setModelAnimation(event.target.value));
  elements.modelAnimationToggle.addEventListener("click", () => {
    scene3d?.setModelPlaying(latestModelInfo?.mixerState !== "PLAYING");
  });

  elements.depthSettingsOpen.addEventListener("click", openDepthSettings);
  elements.depthSettingsClose.addEventListener("click", closeDepthSettings);
  elements.depthSettingsBackdrop.addEventListener("click", closeDepthSettings);
  elements.depthSettingsLayer.addEventListener("input", (event) => {
    if (event.target !== elements.depthStrength) return;
    readDepthSettingsUI();
    applyDepthSettings();
  });
  elements.depthSettingsLayer.addEventListener("change", (event) => {
    if (!event.target.matches('input[name="depth-mode"], input[name="depth-invert"], select, #depth-max-step')) return;
    readDepthSettingsUI();
    applyDepthSettings();
  });
  elements.resetDepthSettings.addEventListener("click", () => {
    Object.assign(depthSettings, DEFAULT_DEPTH_SETTINGS);
    applyDepthSettings();
  });
  async function loadDepthFile(kind, input) {
    const [file] = input.files ?? [];
    if (!file) return;
    try { await scene3d.loadDepthPhotoImage(kind, file); } catch { /* Friendly error arrives through the scene callback. */ }
    finally { input.value = ""; }
  }
  elements.photoFileInput.addEventListener("change", () => loadDepthFile("photo", elements.photoFileInput));
  elements.depthFileInput.addEventListener("change", () => loadDepthFile("depth", elements.depthFileInput));

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
  document.addEventListener("visibilitychange", updateOrientationLayout);
  window.addEventListener("resize", updateOrientationLayout, { passive: true });
  window.screen?.orientation?.addEventListener?.("change", updateOrientationLayout);

  scene3d = await createScene3D({
    canvas: elements.canvas,
    container: elements.viewport,
    onStatus: ({ available, message }) => {
      elements.webglBadge.textContent = available ? "WEBGL ACTIVE" : "WEBGL UNAVAILABLE";
      elements.sceneFallback.hidden = available;
      elements.debug.webgl.textContent = available ? message : `非対応: ${message}`;
    },
    onSceneChange: ({ id, label }) => {
      currentSceneId = id;
      elements.sceneName.textContent = label;
      elements.debug.currentScene.textContent = label;
      elements.modelDock.hidden = id !== "model";
      elements.depthDock.hidden = id !== "depth";
      if (id === "model") updateModelUI(scene3d?.getModelInfo());
      if (id === "depth") updateDepthUI(scene3d?.getDepthPhotoInfo());
      if (id !== "model" && !elements.modelSettingsLayer.hidden) closeModelSettings();
      if (id !== "depth" && !elements.depthSettingsLayer.hidden) closeDepthSettings();
    },
    onModelUpdate: updateModelUI,
    onDepthPhotoUpdate: updateDepthUI,
    depthPhotoSettings: depthSettings,
  });
  scene3d.setDebugVisible(elements.debugToggle.checked);
  scene3d.setViewCalibration({ viewMode: calibration.viewMode, fov: calibration.fov });
  renderDepthSettingsUI();
  updateOrientationLayout();
}

init();
