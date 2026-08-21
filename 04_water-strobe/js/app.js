import { CameraController } from "./camera.js";
import { TorchController } from "./torch.js";
import { StrobeController, clampFrequency } from "./strobe.js";
import { RecorderController } from "./recorder.js";
import { diagnosticText, copyText } from "./diagnostics.js";
import { loadState, saveState, makePresetName } from "./storage.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const logs = [];
const log = (message) => {
  const now = new Date();
  const stamp = `${now.toLocaleTimeString("ja-JP", { hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;
  logs.push(`${stamp} ${message}`);
  if (logs.length > 300) logs.shift();
  refreshDiagnostics();
};

const saved = loadState();
const state = {
  ...saved,
  cameraStarted: false,
  torchSupported: false,
  torchRequested: false,
  torchActual: false,
  strobeRunning: false,
  recording: false,
  wakeLockSupported: "wakeLock" in navigator,
  wakeLockActive: false
};

const camera = new CameraController(log);
const torch = new TorchController(() => camera.track, log);
const strobe = new StrobeController(torch, log);
const recorder = new RecorderController(log);
let wakeLock = null;
let safetyAccepted = false;

function persist() {
  saveState({
    frequency: state.frequency,
    duty: state.duty,
    autoStop: state.autoStop,
    wakeLock: state.wakeLock,
    recordingEnabled: state.recordingEnabled,
    presets: state.presets,
    stopPoints: state.stopPoints
  });
}

function setStatus(text, tone = "idle") {
  $("#status").textContent = text;
  $("#status").dataset.tone = tone;
}

function setError(message) {
  $("#error-message").textContent = message;
  $("#error-box").hidden = false;
}

function clearError() {
  $("#error-box").hidden = true;
  $("#error-message").textContent = "";
}

function updateMain() {
  $("#frequency-value").textContent = Number(state.frequency).toFixed(2);
  $("#frequency-input").value = state.frequency;
  $("#frequency-range").value = state.frequency;
  $$("[data-duty]").forEach((button) => button.classList.toggle("is-selected", Number(button.dataset.duty) === Number(state.duty)));
  $("#strobe-button").textContent = state.strobeRunning ? "ストロボ停止" : "ストロボ開始";
  $("#strobe-button").classList.toggle("is-active", state.strobeRunning);
  $("#active-badge").hidden = !state.strobeRunning;
  $("#prepare-panel").hidden = state.cameraStarted;
  $("#controls-panel").hidden = !state.cameraStarted;
  $("#recording-controls").hidden = !state.recordingEnabled;
  $("#record-button").textContent = state.recording ? "録画停止" : "録画開始";
  $("#recording-badge").hidden = !state.recording;
  $("#camera-preview-wrap").hidden = !state.recordingEnabled;
  $("#last-stop").hidden = !state.stopPoints.length;
  if (state.stopPoints.length) $("#last-stop-value").textContent = `${state.stopPoints[0].frequency.toFixed(2)} Hz`;
  renderStopPoints();
  renderPresets();
}

function setFrequency(value) {
  state.frequency = clampFrequency(value);
  strobe.configure({ frequency: state.frequency, duty: state.duty, autoStopSeconds: state.autoStop });
  persist();
  updateMain();
}

function setDuty(value) {
  state.duty = Number(value);
  strobe.configure({ frequency: state.frequency, duty: state.duty, autoStopSeconds: state.autoStop });
  persist();
  updateMain();
}

async function prepareCamera() {
  clearError();
  $("#prepare-button").disabled = true;
  $("#prepare-button").textContent = "準備中…";
  setStatus("CHECKING", "idle");
  try {
    state.torchSupported = await camera.prepare();
    state.cameraStarted = true;
    camera.track.addEventListener("ended", async () => {
      if (state.strobeRunning) await strobe.stop("Camera track ended -> Strobe stopped");
      state.cameraStarted = false;
      state.torchSupported = false;
      setStatus("NOT READY", "error");
      setError("カメラが停止しました。ライトをもう一度準備してください");
      updateMain();
    }, { once: true });
    $("#camera-preview").srcObject = camera.stream;
    if (!state.torchSupported) {
      setStatus("NOT SUPPORTED", "error");
      setError("この端末ではライト制御を利用できません");
      state.cameraStarted = false;
      camera.stop();
    } else {
      setStatus("READY", "ready");
      log("Ready");
    }
  } catch (error) {
    setStatus("NOT READY", "error");
    setError(error.message || "ライトを準備できませんでした");
    log(`Camera error: ${error.name || "Error"}: ${error.message}`);
  } finally {
    $("#prepare-button").disabled = false;
    $("#prepare-button").textContent = "ライトを準備";
    updateMain();
  }
}

function showSafetyDialog() {
  return new Promise((resolve) => {
    const dialog = $("#safety-dialog");
    dialog.showModal();
    const finish = (accepted) => {
      dialog.close();
      resolve(accepted);
    };
    $("#safety-cancel").onclick = () => finish(false);
    $("#safety-accept").onclick = () => finish(true);
  });
}

async function toggleStrobe() {
  clearError();
  if (state.strobeRunning) {
    await strobe.stop("Strobe stopped by user");
    return;
  }
  if (!state.cameraStarted || !state.torchSupported) {
    setError("先にライトを準備してください");
    return;
  }
  if (!safetyAccepted) {
    safetyAccepted = await showSafetyDialog();
    if (!safetyAccepted) return;
  }
  strobe.configure({ frequency: state.frequency, duty: state.duty, autoStopSeconds: state.autoStop });
  if (state.wakeLock) await requestWakeLock();
  try {
    await strobe.start();
  } catch (error) {
    setError("ストロボを開始できませんでした");
    log(`Strobe start error: ${error.message}`);
  }
}

async function requestWakeLock() {
  if (!navigator.wakeLock?.request) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLockActive = true;
    wakeLock.addEventListener("release", () => {
      state.wakeLockActive = false;
      refreshDiagnostics();
    });
  } catch (error) {
    log(`Wake Lock failed: ${error.message}`);
  }
}

function releaseWakeLock() {
  wakeLock?.release?.();
  wakeLock = null;
  state.wakeLockActive = false;
}

function saveStopPoint() {
  state.stopPoints.unshift({ frequency: state.frequency, duty: state.duty, date: new Date().toISOString() });
  state.stopPoints = state.stopPoints.slice(0, 20);
  persist();
  updateMain();
  navigator.vibrate?.(20);
}

function renderStopPoints() {
  $("#stop-point-list").innerHTML = state.stopPoints.length
    ? state.stopPoints.map((point) => `<li><button type="button" data-stop-frequency="${point.frequency}" data-stop-duty="${point.duty}"><strong>${Number(point.frequency).toFixed(2)} Hz</strong><span>Duty ${point.duty}% · ${new Date(point.date).toLocaleString("ja-JP")}</span></button></li>`).join("")
    : "<li class=\"empty-row\">まだ保存されていません</li>";
}

function renderPresets() {
  $("#preset-list").innerHTML = state.presets.length
    ? state.presets.map((preset, index) => `<li><button type="button" data-preset-index="${index}"><strong>${escapeHtml(preset.name)}</strong><span>${Number(preset.frequency).toFixed(2)} Hz · Duty ${preset.duty}%</span></button><button class="delete-small" type="button" aria-label="${escapeHtml(preset.name)}を削除" data-delete-preset="${index}">×</button></li>`).join("")
    : "<li class=\"empty-row\">プリセットはありません</li>";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function savePreset() {
  const name = $("#preset-name").value.trim() || makePresetName(state.presets);
  state.presets.push({ name, frequency: state.frequency, duty: state.duty });
  $("#preset-name").value = "";
  $("#preset-save-status").textContent = `「${name}」を保存しました`;
  persist();
  renderPresets();
}

async function toggleRecording() {
  if (state.recording) {
    recorder.stop();
    return;
  }
  try {
    recorder.start(camera.stream);
    state.recording = true;
    updateMain();
  } catch (error) {
    setError(error.message);
    log(`Recorder error: ${error.message}`);
  }
}

function refreshDiagnostics() {
  if (!$("#diagnostics-view") || $("#diagnostics-view").hidden) return;
  const text = diagnosticText({ camera, torch, strobe, recorder, state, logs });
  $("#diagnostic-output").textContent = text;
}

function openView(name) {
  $("#main-view").hidden = name !== "main";
  $("#diagnostics-view").hidden = name !== "diagnostics";
  $("#details-panel").hidden = name !== "details";
  if (name === "diagnostics") refreshDiagnostics();
  scrollTo({ top: 0, behavior: "smooth" });
}

strobe.addEventListener("start", () => {
  state.strobeRunning = true;
  setStatus("STROBE ACTIVE", "active");
  updateMain();
});
strobe.addEventListener("stop", () => {
  state.strobeRunning = false;
  state.torchRequested = false;
  setStatus("READY", "ready");
  releaseWakeLock();
  updateMain();
});
strobe.addEventListener("error", (event) => setError(`ストロボを続けられませんでした。診断をご確認ください。`));
recorder.addEventListener("ready", (event) => {
  state.recording = false;
  const extension = event.detail.type.includes("mp4") ? "mp4" : "webm";
  $("#recording-preview").src = event.detail.url;
  $("#recording-result").hidden = false;
  $("#save-video").href = event.detail.url;
  $("#save-video").download = `water-strobe-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  updateMain();
});
recorder.addEventListener("error", (event) => {
  state.recording = false;
  setError("動画の撮影を続けられませんでした");
  log(`Recorder error: ${event.detail.message}`);
  updateMain();
});

$("#prepare-button").addEventListener("click", prepareCamera);
$("#strobe-button").addEventListener("click", toggleStrobe);
$$("[data-adjust]").forEach((button) => button.addEventListener("click", () => setFrequency(state.frequency + Number(button.dataset.adjust))));
$$("[data-duty]").forEach((button) => button.addEventListener("click", () => setDuty(button.dataset.duty)));
$("#water-down").addEventListener("click", () => setFrequency(state.frequency - 0.01));
$("#water-up").addEventListener("click", () => setFrequency(state.frequency + 0.01));
$("#save-stop").addEventListener("click", saveStopPoint);
$("#frequency-range").addEventListener("input", (event) => setFrequency(event.target.value));
$("#frequency-input").addEventListener("change", (event) => setFrequency(event.target.value));
$$("[data-frequency]").forEach((button) => button.addEventListener("click", () => setFrequency(button.dataset.frequency)));
$("#auto-stop").value = state.autoStop;
$("#auto-stop").addEventListener("change", (event) => { state.autoStop = Number(event.target.value); persist(); });
$("#wake-lock").checked = state.wakeLock;
$("#wake-lock").addEventListener("change", (event) => { state.wakeLock = event.target.checked; persist(); });
$("#recording-enabled").checked = state.recordingEnabled;
$("#recording-enabled").addEventListener("change", (event) => { state.recordingEnabled = event.target.checked; persist(); updateMain(); });
$("#record-button").addEventListener("click", toggleRecording);
$("#preset-save").addEventListener("click", savePreset);
$("#preset-name").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    savePreset();
  }
});
$("#preset-list").addEventListener("click", (event) => {
  const apply = event.target.closest("[data-preset-index]");
  const remove = event.target.closest("[data-delete-preset]");
  if (apply) {
    const preset = state.presets[Number(apply.dataset.presetIndex)];
    setFrequency(preset.frequency);
    setDuty(preset.duty);
  }
  if (remove) {
    state.presets.splice(Number(remove.dataset.deletePreset), 1);
    persist();
    renderPresets();
  }
});
$("#stop-point-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-stop-frequency]");
  if (!button) return;
  setFrequency(button.dataset.stopFrequency);
  setDuty(button.dataset.stopDuty);
});
$("#details-button").addEventListener("click", () => openView("details"));
$("#diagnostics-button").addEventListener("click", () => openView("diagnostics"));
$("#diagnostics-button-secondary").addEventListener("click", () => openView("diagnostics"));
$("#prepare-diagnostics").addEventListener("click", () => openView("diagnostics"));
$$("[data-back]").forEach((button) => button.addEventListener("click", () => openView("main")));
$("#torch-on").addEventListener("click", async () => { try { await torch.set(true); refreshDiagnostics(); } catch (error) { log(error.message); } });
$("#torch-off").addEventListener("click", async () => { try { await torch.set(false); refreshDiagnostics(); } catch (error) { log(error.message); } });
$("#copy-diagnostics").addEventListener("click", async () => { await copyText(diagnosticText({ camera, torch, strobe, recorder, state, logs })); $("#copy-diagnostics").textContent = "コピーしました"; });
$("#copy-log").addEventListener("click", async () => { await copyText(logs.join("\n")); $("#copy-log").textContent = "コピーしました"; });
$("#clear-log").addEventListener("click", () => { logs.length = 0; refreshDiagnostics(); });

document.addEventListener("visibilitychange", async () => {
  if (document.hidden && state.strobeRunning) await strobe.stop("Page hidden -> Strobe stopped");
});
globalThis.addEventListener("beforeunload", () => {
  clearTimeout(strobe.timer);
  camera.track?.applyConstraints?.({ advanced: [{ torch: false }] }).catch(() => {});
  camera.stop();
});

strobe.configure({ frequency: state.frequency, duty: state.duty, autoStopSeconds: state.autoStop });
updateMain();
setStatus("NOT READY", "idle");
if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
