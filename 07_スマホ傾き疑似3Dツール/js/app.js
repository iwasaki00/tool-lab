import { OrientationController, SENSOR_STATES } from "./orientation.js";
import { TiltRenderer } from "./renderer.js";

export const VERSION = "0.1.0";

const elements = {
  root: document.documentElement,
  stage: document.querySelector("#motion-stage"),
  card: document.querySelector("#tilt-card"),
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
  debug: {
    alpha: document.querySelector("#debug-alpha"), beta: document.querySelector("#debug-beta"),
    gamma: document.querySelector("#debug-gamma"), raw: document.querySelector("#debug-raw"),
    smooth: document.querySelector("#debug-smooth"), state: document.querySelector("#debug-state"),
    orientation: document.querySelector("#debug-orientation"), fps: document.querySelector("#debug-fps"),
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

const orientation = new OrientationController({
  onStateChange: ({ state, detail }) => updateStateUI(state, detail),
});

const renderer = new TiltRenderer({
  root: elements.root,
  card: elements.card,
  inputProvider: () => orientation.getSnapshot(),
  onFrame: (frame) => {
    latestFrame = frame;
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
  elements.debug.raw.textContent = `${snapshot.tiltX.toFixed(3)} / ${snapshot.tiltY.toFixed(3)}`;
  elements.debug.smooth.textContent = `${frame.smoothX.toFixed(3)} / ${frame.smoothY.toFixed(3)}`;
  elements.debug.state.textContent = snapshot.state;
  elements.debug.orientation.textContent = `${snapshot.orientation} / ${snapshot.screenAngle}°`;
  elements.debug.fps.textContent = frame.fps ? String(frame.fps) : "計測中";
}

function handlePointerMove(event) {
  if (event.pointerType === "touch" || orientation.state === SENSOR_STATES.ACTIVE) return;
  const rect = elements.stage.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  orientation.setMouseTilt(x, y);
}

function init() {
  document.querySelectorAll("[data-version]").forEach((node) => { node.textContent = `Version ${VERSION}`; });
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) orientation.enableMouseSimulation();
  else updateStateUI(SENSOR_STATES.IDLE);

  elements.start.addEventListener("click", () => orientation.start());
  elements.reset.addEventListener("click", () => {
    orientation.resetNeutral();
    renderer.centerImmediately();
    elements.statusMessage.textContent = orientation.state === SENSOR_STATES.ACTIVE
      ? "現在の端末姿勢を中央位置に設定しました。"
      : "表示を中央位置に戻しました。";
  });
  elements.stage.addEventListener("pointermove", handlePointerMove, { passive: true });
  elements.stage.addEventListener("pointerleave", () => {
    if (orientation.state !== SENSOR_STATES.ACTIVE) orientation.setMouseTilt(0, 0);
  }, { passive: true });
  elements.sensitivity.addEventListener("input", (event) => {
    renderer.setSensitivity(event.target.value);
    elements.sensitivityValue.value = `${event.target.value}%`;
  });
  elements.smoothing.addEventListener("change", (event) => renderer.setSmoothing(event.target.value));
  elements.debugToggle.addEventListener("change", () => {
    elements.debugPanel.hidden = !elements.debugToggle.checked;
    if (elements.debugToggle.checked) updateDebug();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) renderer.stop(); else renderer.start();
  });

  renderer.setSensitivity(elements.sensitivity.value);
  renderer.setSmoothing(elements.smoothing.value);
  renderer.start();
}

init();
