"use strict";

import {
  EXAM_PRESETS_MINUTES,
  POMODORO_PHASES,
  RESUME_MODES,
  TIMER_DISPLAY_MODES,
  TIMER_EVENTS,
  TIMER_MODES,
  TIMER_PRESETS_MINUTES,
  TIMER_STATES
} from "./constants.js";
import {
  addSubject,
  loadPreferences,
  removeQuickTimer,
  removeSubject,
  resetPreferences,
  saveSettings,
  updateSubject,
  upsertQuickTimer
} from "./settings.js";
import { onStorageError } from "./storage.js";
import { StudyTimer } from "./timer.js";
import {
  buildHistorySummary,
  clearSessions,
  listSessions,
  saveSession
} from "./history.js";
import { AttendanceController, ATTENDANCE_STATES } from "./attendanceController.js";
import { CameraController, CAMERA_STATES } from "./camera.js";
import { createNotifier } from "./notifier.js";
import { createWakeLockManager, getWakeLockCapability } from "./wakeLock.js";
import {
  DEBUG_ENABLED,
  createDebugSnapshot,
  createDebugTools
} from "./debug.js";
import {
  UIController,
  formatDuration,
  getStateLabel
} from "./ui.js";

const MINUTE_MS = 60_000;
const ACTIVE_STATES = new Set([
  TIMER_STATES.RUNNING,
  TIMER_STATES.ABSENCE_PENDING,
  TIMER_STATES.BREAK
]);
const STUDY_MONITORING_STATES = new Set([
  TIMER_STATES.RUNNING,
  TIMER_STATES.ABSENCE_PENDING,
  TIMER_STATES.ABSENCE_PAUSED
]);
const STORAGE_WARNING = "端末への保存が制限されています。この画面を開いている間はタイマーを使用できます。";

const ui = new UIController(document);
onStorageError(() => ui.showError(STORAGE_WARNING));
let preferences = loadPreferences();
let settings = preferences.settings;
let subjects = preferences.subjects;
let quickTimers = preferences.quickTimers;
let timer = null;
let currentSnapshot = null;
let latestFace = null;
let latestHand = null;
let latestCameraMetrics = null;
let activeSessionMetadata = null;
let sessionSaveInFlight = new Set();
let pendingExamUnlockTimer = 0;
let examUnlockCompleted = false;
let pendingSettingsRebuild = false;

const debugEnabled = DEBUG_ENABLED || Boolean(settings.debug?.enabled);
const camera = new CameraController({
  handEnabled: settings.camera.gestureEnabled,
  debug: debugEnabled
});
const attendance = new AttendanceController(attendanceOptions());
const notifier = createNotifier({
  mode: settings.notifications.endMethod,
  volume: settings.notifications.volume,
  sound: settings.notifications.sound
});
const wakeLock = createWakeLockManager();
const debugTools = createDebugTools({ enabled: debugEnabled });

init().catch((error) => {
  console.error("[Focus Lens] initialization failed", error);
  ui.showError("初期化中に問題が発生しました。再読み込みしても直らない場合は、通常のタイマーとしてお試しください。");
});

async function init() {
  ui.applyTheme(settings.appearance);
  ui.setDebugVisible(debugEnabled);
  populateSettingsForm();
  renderSubjectsAndQuickTimers();
  rebuildTimer();
  bindNavigation();
  bindTimerControls();
  bindSettingsControls();
  bindDialogs();
  bindCameraEvents();
  bindAttendanceEvents();
  bindDebugControls();
  bindLifecycle();
  bindErrorHandling();
  ui.startClock(() => settings.clock.format);
  await refreshHistory();
  updateCameraPresentation();
  registerServiceWorker();
}

function attendanceOptions() {
  const timeoutSeconds = settings.camera.absenceTimeoutSeconds;
  return {
    enabled: settings.camera.absenceDetectionEnabled,
    autoPauseEnabled: settings.camera.absenceDetectionEnabled,
    pendingAfterMs: 10_000,
    pauseAfterMs: timeoutSeconds === null ? Number.POSITIVE_INFINITY : timeoutSeconds * 1_000,
    autoResume: settings.camera.resumeMode === RESUME_MODES.AUTO
  };
}

function shouldMonitorAttendance(snapshot) {
  return Boolean(
    snapshot
    && snapshot.config?.absenceDetectionEnabled
    && Number.isFinite(snapshot.config?.absenceTimeoutMs)
    && snapshot.config.absenceTimeoutMs > 0
    && STUDY_MONITORING_STATES.has(snapshot.state)
    && !(snapshot.state === TIMER_STATES.ABSENCE_PAUSED && snapshot.activeAbsence?.faceRedetectedAt)
    && !snapshot.background
  );
}

function timerOptions() {
  const mode = settings.timer.lastMode;
  const durationMinutes = mode === TIMER_MODES.EXAM
    ? settings.exam.durationMinutes
    : settings.timer.lastDurationMinutes;
  return {
    mode,
    durationMinutes,
    durationMs: mode === TIMER_MODES.STOPWATCH ? null : durationMinutes * MINUTE_MS,
    countUpEnabled: settings.timer.countUpEnabled,
    absenceDetectionEnabled: settings.camera.absenceDetectionEnabled && mode !== TIMER_MODES.EXAM,
    absenceTimeoutSeconds: settings.camera.absenceTimeoutSeconds,
    resumeMode: settings.camera.resumeMode,
    pomodoro: settings.pomodoro,
    exam: {
      ...settings.exam,
      // Lock is a deliberate per-session action, not a startup surprise.
      lockEnabled: false
    }
  };
}

function rebuildTimer() {
  timer?.destroy();
  timer = new StudyTimer(timerOptions());
  attendance.configure(attendanceOptions());
  attendance.reset({ monitoring: false });
  pendingSettingsRebuild = false;
  currentSnapshot = timer.getSnapshot();
  bindTimerEvents();
  ui.setMode(currentSnapshot.mode);
  renderPresets();
  renderTimer(currentSnapshot);
  updateRuntimeActivity(currentSnapshot);
}

function bindTimerEvents() {
  timer.addEventListener(TIMER_EVENTS.TICK, (event) => {
    currentSnapshot = event.detail;
    renderTimer(currentSnapshot);
    if (debugEnabled) updateDebugReadout();
  });

  timer.addEventListener(TIMER_EVENTS.STATE_CHANGE, (event) => {
    currentSnapshot = event.detail.snapshot;
    updateRuntimeActivity(currentSnapshot);
    updateCameraPresentation();
  });

  timer.addEventListener(TIMER_EVENTS.ABSENCE_CHANGE, (event) => {
    const detail = event.detail;
    currentSnapshot = detail.snapshot || timer.getSnapshot();
    if (detail.type === "auto_paused") {
      notifier.notifyEvent("absent");
      ui.showToast("離席時間を除外して一時停止しました");
    } else if (detail.type === "face_returned") {
      notifier.notifyEvent("returned");
      if (detail.requiresConfirmation) ui.openDialog("absence-resume-dialog");
    } else if (["candidate_cancelled", "resumed"].includes(detail.type)) {
      ui.setAbsencePending({ active: false });
    }
    updateCameraPresentation();
  });

  timer.addEventListener(TIMER_EVENTS.TARGET_REACHED, (event) => {
    currentSnapshot = event.detail.snapshot;
    notifyTimerCompletion("設定時間になりました");
    ui.showToast("設定時間になりました。超過時間を計測中です。", 3000);
  });

  timer.addEventListener(TIMER_EVENTS.COMPLETED, (event) => {
    currentSnapshot = event.detail.snapshot;
    if (event.detail.reason === "duration_elapsed") notifyTimerCompletion("学習時間が終了しました");
    void persistCompletedSession(currentSnapshot);
    updateRuntimeActivity(currentSnapshot);
  });

  timer.addEventListener(TIMER_EVENTS.PHASE_CHANGE, (event) => {
    const previousKind = event.detail.previousPhase?.kind;
    if (previousKind === POMODORO_PHASES.STUDY) {
      notifyTimerCompletion("勉強時間が終了しました");
      ui.showToast("勉強時間が終了しました。休憩へ進みます。", 3000);
    } else {
      startCompletionNotification("breakComplete", "休憩が終了しました");
      ui.showToast("休憩が終了しました。次の勉強へ進みます。", 3000);
    }
  });

  timer.addEventListener(TIMER_EVENTS.THRESHOLD, (event) => {
    const minutes = Math.round(event.detail.thresholdMs / MINUTE_MS);
    ui.showToast(minutes >= 1 ? `試験終了まで${minutes}分です` : "試験終了まで1分です", 2600);
    if (settings.exam.visualOnly) notifier.flash();
    else notifier.notifyEvent("complete", notificationOptions());
  });

  timer.addEventListener(TIMER_EVENTS.BACKGROUND_QUESTION, () => {
    ui.openDialog("background-dialog");
  });

  timer.addEventListener(TIMER_EVENTS.LOCKED_ACTION, (event) => {
    const labels = { pause: "一時停止", reset: "リセット", finish: "終了" };
    ui.showToast(`${labels[event.detail.action] || "操作"}はロックされています`);
  });
}

function renderTimer(snapshot) {
  const displayElapsed = snapshot.mode === TIMER_MODES.STOPWATCH
    || (snapshot.mode === TIMER_MODES.EXAM && snapshot.displayMode === TIMER_DISPLAY_MODES.ELAPSED);
  const displayMs = displayElapsed ? snapshot.elapsedMs : (snapshot.remainingMs ?? snapshot.elapsedMs);
  const progress = snapshot.durationMs
    ? Math.min(100, snapshot.elapsedMs / snapshot.durationMs * 100)
    : 0;
  const advancing = ACTIVE_STATES.has(snapshot.state);
  let startLabel = "開始";
  let startIcon = "▶";
  if (advancing) {
    startLabel = snapshot.state === TIMER_STATES.BREAK ? "休憩を一時停止" : "一時停止";
    startIcon = "Ⅱ";
  } else if (snapshot.state === TIMER_STATES.PAUSED) {
    startLabel = "再開";
  } else if (snapshot.state === TIMER_STATES.ABSENCE_PAUSED) {
    startLabel = snapshot.activeAbsence?.faceRedetectedAt ? "再開を確認" : "離席中";
  } else if (snapshot.state === TIMER_STATES.COMPLETED) {
    startLabel = "もう一度";
  }

  const statusLabel = snapshot.mode === TIMER_MODES.POMODORO && snapshot.state === TIMER_STATES.PAUSED
    && snapshot.pauseReason === "phase_wait"
    ? (snapshot.phase.kind === POMODORO_PHASES.STUDY ? "勉強の開始待ち" : "休憩の開始待ち")
    : getStateLabel(snapshot.state);

  ui.renderTimer({
    display: formatDuration(displayMs, { alwaysHours: displayMs >= 3_600_000 }),
    caption: displayElapsed ? "経過時間" : "残り時間",
    progress,
    state: snapshot.state,
    statusLabel,
    overtimeMs: snapshot.overtimeMs,
    showOvertime: snapshot.overtimeMs > 0,
    startLabel,
    startIcon,
    canReset: !snapshot.examLocked,
    canRepeat: snapshot.state === TIMER_STATES.COMPLETED,
    canFinish: Boolean(snapshot.sessionStartedAt) && snapshot.state !== TIMER_STATES.COMPLETED && !snapshot.examLocked,
    configuredMinutes: getConfiguredMinutes(snapshot.mode),
    pomodoro: buildPomodoroView(snapshot),
    examDisplay: snapshot.displayMode,
    examLocked: snapshot.examLocked
  });

  if (snapshot.absenceCandidate) {
    const remainingSeconds = (snapshot.absenceCandidate.pauseAt - Date.now()) / 1000;
    ui.setAbsencePending({
      active: snapshot.state === TIMER_STATES.ABSENCE_PENDING,
      remainingSeconds
    });
  } else {
    ui.setAbsencePending({ active: false });
  }
}

function buildPomodoroView(snapshot) {
  if (snapshot.mode !== TIMER_MODES.POMODORO) return null;
  const phaseIsStudy = snapshot.phase.kind === POMODORO_PHASES.STUDY;
  const setNumber = Math.max(1, snapshot.phase.setNumber || 1);
  const totalSets = snapshot.phase.longBreakEvery || settings.pomodoro.longBreakEvery;
  const longBreakNext = phaseIsStudy && setNumber % totalSets === 0;
  return {
    phaseLabel: phaseIsStudy ? "勉強" : snapshot.phase.kind === POMODORO_PHASES.LONG_BREAK ? "長い休憩" : "休憩",
    currentSet: Math.min(setNumber, totalSets),
    totalSets,
    nextLabel: phaseIsStudy
      ? `${longBreakNext ? "長い休憩" : "休憩"}${longBreakNext ? settings.pomodoro.longBreakMinutes : settings.pomodoro.shortBreakMinutes}分`
      : `勉強${settings.pomodoro.studyMinutes}分`
  };
}

function getConfiguredMinutes(mode) {
  if (mode === TIMER_MODES.EXAM) return settings.exam.durationMinutes;
  if (mode === TIMER_MODES.POMODORO) return settings.pomodoro.studyMinutes;
  return settings.timer.lastDurationMinutes;
}

function renderPresets() {
  const mode = settings.timer.lastMode;
  const presets = mode === TIMER_MODES.EXAM ? EXAM_PRESETS_MINUTES : TIMER_PRESETS_MINUTES;
  ui.renderPresets(presets, getConfiguredMinutes(mode));
}

function bindNavigation() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.viewTarget;
      ui.setView(view);
      syncPreviewStreams();
      if (view === "history") void refreshHistory();
    });
  });
  document.getElementById("open-settings").addEventListener("click", () => {
    ui.setView("settings");
    syncPreviewStreams();
  });
  document.getElementById("dismiss-error").addEventListener("click", () => ui.clearError());
}

function bindTimerControls() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => void changeMode(button.dataset.mode));
  });

  document.getElementById("preset-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("[data-minutes]");
    if (button) void changeDuration(Number(button.dataset.minutes));
  });
  document.getElementById("apply-custom-minutes").addEventListener("click", () => {
    void changeDuration(Number(document.getElementById("custom-minutes").value));
  });
  document.getElementById("custom-minutes").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void changeDuration(Number(event.currentTarget.value));
    }
  });

  document.getElementById("start-pause-button").addEventListener("click", () => void toggleTimer("button"));
  document.getElementById("reset-button").addEventListener("click", () => void resetCurrentTimer());
  document.getElementById("repeat-button").addEventListener("click", () => {
    if (pendingSettingsRebuild) rebuildTimer();
    attendance.reset({ monitoring: false });
    activeSessionMetadata = captureSessionMetadata();
    timer.repeat(Date.now(), { force: true, autoStart: true });
  });
  document.getElementById("finish-button").addEventListener("click", () => {
    const finishMemo = document.getElementById("finish-memo");
    finishMemo.value = document.getElementById("session-memo").value;
    ui.openDialog("finish-dialog");
  });
  document.getElementById("exam-display-toggle").addEventListener("click", toggleExamDisplay);
  document.getElementById("exam-no-pause").addEventListener("change", (event) => {
    settings = saveSettings({ exam: { pauseDisabled: event.target.checked } });
    reconfigureTimerIfIdle();
  });
  document.getElementById("exam-visual-only").addEventListener("change", (event) => {
    settings = saveSettings({ exam: { visualOnly: event.target.checked } });
  });
  bindExamLockControl();

  document.getElementById("quick-timer-strip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-quick-index]");
    if (button) void applyQuickTimer(Number(button.dataset.quickIndex));
  });
}

async function changeMode(mode) {
  if (!Object.values(TIMER_MODES).includes(mode) || mode === settings.timer.lastMode) return;
  if (!await endActiveSessionForReconfiguration()) {
    ui.setMode(settings.timer.lastMode);
    return;
  }
  settings = saveSettings({ timer: { lastMode: mode } });
  activeSessionMetadata = null;
  rebuildTimer();
}

async function changeDuration(minutes) {
  minutes = Math.round(minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) {
    ui.showError("時間は1〜720分で指定してください。");
    return;
  }
  if (!await endActiveSessionForReconfiguration()) return;
  if (settings.timer.lastMode === TIMER_MODES.EXAM) {
    settings = saveSettings({ exam: { durationMinutes: minutes } });
  } else {
    settings = saveSettings({ timer: { lastDurationMinutes: minutes } });
  }
  rebuildTimer();
}

async function endActiveSessionForReconfiguration() {
  const snapshot = timer.getSnapshot();
  if (!snapshot.sessionStartedAt || snapshot.state === TIMER_STATES.COMPLETED) return true;
  const confirmed = await ui.confirm({
    title: "現在の学習を終了しますか？",
    message: "ここまでの時間を途中終了として履歴に保存してから、設定を変更します。",
    confirmLabel: "終了して変更"
  });
  if (!confirmed) return false;
  timer.finish(Date.now(), { completed: false, force: true });
  return true;
}

async function toggleTimer(source) {
  let snapshot = timer.getSnapshot();
  if (snapshot.state === TIMER_STATES.COMPLETED && pendingSettingsRebuild) {
    rebuildTimer();
    snapshot = timer.getSnapshot();
  }
  if (snapshot.state === TIMER_STATES.COMPLETED) {
    attendance.reset({ monitoring: false });
  }
  if (snapshot.state === TIMER_STATES.ABSENCE_PAUSED) {
    if (snapshot.activeAbsence?.faceRedetectedAt) {
      ui.openDialog("absence-resume-dialog");
    } else if (!camera.getSnapshot().active) {
      attendance.reset({ monitoring: false });
      timer.resumeFromAbsence(Date.now(), { force: true });
      ui.showToast("カメラなしで学習を再開しました");
    } else {
      ui.showToast("顔を再検出すると再開できます");
    }
    return false;
  }

  void notifier.unlock();
  let action = null;
  if (ACTIVE_STATES.has(snapshot.state)) {
    action = timer.pause(Date.now()) ? "pause" : null;
  } else {
    if ([TIMER_STATES.IDLE, TIMER_STATES.COMPLETED].includes(snapshot.state)) {
      activeSessionMetadata = captureSessionMetadata();
    }
    action = timer.start(Date.now()) ? "start" : null;
  }

  if (source === "gesture" && action) {
    if (settings.notifications.gestureSoundEnabled) {
      await notifier.playGestureTone({ enabled: true, volume: settings.notifications.volume });
    }
    ui.showToast(action === "start" ? "開始しました" : "一時停止しました");
  }
  return Boolean(action);
}

async function resetCurrentTimer() {
  const snapshot = timer.getSnapshot();
  if (snapshot.examLocked) {
    timer.reset(Date.now());
    return;
  }
  if (snapshot.sessionStartedAt && snapshot.state !== TIMER_STATES.COMPLETED) {
    const confirmed = await ui.confirm({
      title: "タイマーをリセットしますか？",
      message: "ここまでの時間は途中終了として履歴に保存されます。",
      confirmLabel: "保存してリセット"
    });
    if (!confirmed) return;
    timer.finish(Date.now(), { completed: false, force: true });
  }
  timer.reset(Date.now(), { force: true });
  attendance.reset({ monitoring: false });
  activeSessionMetadata = null;
  if (pendingSettingsRebuild) rebuildTimer();
}

function toggleExamDisplay() {
  const snapshot = timer.getSnapshot();
  const next = snapshot.displayMode === TIMER_DISPLAY_MODES.REMAINING
    ? TIMER_DISPLAY_MODES.ELAPSED
    : TIMER_DISPLAY_MODES.REMAINING;
  timer.setDisplayMode(next);
  settings = saveSettings({ exam: { displayMode: next } });
}

function bindExamLockControl() {
  const button = document.getElementById("exam-lock-toggle");
  button.addEventListener("click", () => {
    if (examUnlockCompleted) {
      examUnlockCompleted = false;
      return;
    }
    const snapshot = timer.getSnapshot();
    if (!snapshot.examLocked) {
      timer.setExamLock(true);
      ui.showToast("試験中の操作をロックしました");
    } else {
      ui.showToast("1.2秒長押しすると解除できます");
    }
  });
  const begin = () => {
    if (!timer.getSnapshot().examLocked) return;
    window.clearTimeout(pendingExamUnlockTimer);
    pendingExamUnlockTimer = window.setTimeout(() => {
      examUnlockCompleted = true;
      timer.setExamLock(false);
      ui.showToast("操作ロックを解除しました");
      if (navigator.vibrate) navigator.vibrate(35);
    }, 1200);
  };
  const cancel = () => window.clearTimeout(pendingExamUnlockTimer);
  button.addEventListener("pointerdown", begin);
  button.addEventListener("pointerup", cancel);
  button.addEventListener("pointercancel", cancel);
  button.addEventListener("pointerleave", cancel);
}

function bindSettingsControls() {
  document.getElementById("settings-view").addEventListener("change", (event) => {
    if (event.target.id.startsWith("setting-")) void handleSettingChange(event.target);
  });
  document.getElementById("settings-camera-action").addEventListener("click", () => {
    const cameraSnapshot = camera.getSnapshot();
    if (cameraSnapshot.active || [CAMERA_STATES.REQUESTING, CAMERA_STATES.LOADING].includes(cameraSnapshot.state)) {
      void disableCamera({ persist: true });
    }
    else void enableCameraWithConsent();
  });
  document.getElementById("camera-assist-button").addEventListener("click", () => {
    if (camera.getSnapshot().active) {
      ui.openDialog("camera-calibration-dialog");
      syncPreviewStreams();
    }
    else void enableCameraWithConsent();
  });
  document.getElementById("test-notification").addEventListener("click", async () => {
    await notifier.unlock();
    startCompletionNotification("complete", "通知のテスト中です");
  });

  document.getElementById("subject-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("new-subject");
    try {
      addSubject(input.value);
      input.value = "";
      reloadLocalCollections();
    } catch (error) {
      ui.showError(error.message || "教科を追加できませんでした。");
    }
  });
  document.getElementById("subject-settings").addEventListener("click", (event) => {
    const action = event.target.closest("[data-subject-action]");
    if (action) void handleSubjectAction(action);
  });

  document.getElementById("add-quick-timer").addEventListener("click", () => openQuickTimerEditor());
  document.getElementById("quick-timer-settings").addEventListener("click", (event) => {
    const action = event.target.closest("[data-quick-action]");
    if (action) void handleQuickTimerAction(action);
  });
  document.getElementById("quick-timer-form").addEventListener("submit", saveQuickTimerFromDialog);

  document.getElementById("reset-settings-button").addEventListener("click", () => void resetAllPreferences());
  document.getElementById("delete-history-button").addEventListener("click", () => void deleteAllHistory());
  document.getElementById("refresh-history").addEventListener("click", () => void refreshHistory());
}

async function handleSettingChange(control) {
  let patch = {};
  switch (control.id) {
    case "setting-attendance":
      patch = { camera: { absenceDetectionEnabled: control.checked } };
      break;
    case "setting-gesture":
      patch = { camera: { gestureEnabled: control.checked } };
      break;
    case "setting-absence-threshold":
      patch = { camera: { absenceTimeoutSeconds: control.value === "0" ? null : Number(control.value) } };
      break;
    case "setting-resume-mode":
      patch = { camera: { resumeMode: control.value } };
      break;
    case "setting-camera-preview":
      patch = { camera: { previewEnabled: control.checked } };
      break;
    case "setting-notification":
      patch = { notifications: { endMethod: control.value } };
      break;
    case "setting-volume":
      patch = { notifications: { volume: control.value } };
      break;
    case "setting-sound":
      patch = { notifications: { sound: control.value } };
      break;
    case "setting-repeat-alarm":
      patch = { notifications: { repeatUntilStopped: control.checked } };
      break;
    case "setting-gesture-sound":
      patch = { notifications: { gestureSoundEnabled: control.checked } };
      break;
    case "setting-font-size":
      patch = { appearance: { fontSize: control.value } };
      break;
    case "setting-theme":
      patch = { appearance: { theme: control.value } };
      break;
    case "setting-clock-format":
      patch = { clock: { format: control.value } };
      break;
    case "setting-count-up":
      patch = { timer: { countUpEnabled: control.checked } };
      break;
    case "setting-wake-lock":
      patch = { wakeLock: { enabled: control.checked } };
      break;
    case "setting-save-history":
      patch = { history: { enabled: control.checked } };
      break;
    case "setting-pomodoro-study":
      patch = { pomodoro: { studyMinutes: validMinutes(control.value, 25) } };
      break;
    case "setting-pomodoro-short":
      patch = { pomodoro: { shortBreakMinutes: validMinutes(control.value, 5) } };
      break;
    case "setting-pomodoro-long":
      patch = { pomodoro: { longBreakMinutes: validMinutes(control.value, 15) } };
      break;
    case "setting-pomodoro-sets":
      patch = { pomodoro: { longBreakEvery: Math.max(1, Math.min(12, Math.round(Number(control.value) || 4))) } };
      break;
    case "setting-auto-break":
      patch = { pomodoro: { autoStartBreak: control.checked } };
      break;
    case "setting-auto-study":
      patch = { pomodoro: { autoStartStudy: control.checked } };
      break;
    default:
      return;
  }

  settings = saveSettings(patch);
  applySettingsSideEffects(control.id);
}

function validMinutes(value, fallback) {
  const minutes = Math.round(Number(value));
  return Number.isFinite(minutes) ? Math.max(1, Math.min(180, minutes)) : fallback;
}

function applySettingsSideEffects(changedId = "") {
  ui.applyTheme(settings.appearance);
  notifier.setMode(settings.notifications.endMethod);
  notifier.setVolume(settings.notifications.volume);
  notifier.setSound(settings.notifications.sound);
  ui.setCameraPreviewVisible(settings.camera.previewEnabled && camera.getSnapshot().active);
  syncPreviewStreams();
  document.getElementById("settings-camera-preview").hidden = !settings.camera.previewEnabled;
  if (changedId === "setting-gesture") {
    camera.setHandEnabled(settings.camera.gestureEnabled).catch((error) => ui.showError(error.message));
  }
  if (changedId === "setting-wake-lock") updateRuntimeActivity(timer.getSnapshot());

  const timerRelated = new Set([
    "setting-attendance", "setting-absence-threshold", "setting-resume-mode", "setting-count-up",
    "setting-pomodoro-study", "setting-pomodoro-short", "setting-pomodoro-long",
    "setting-pomodoro-sets", "setting-auto-break", "setting-auto-study"
  ]);
  if (timerRelated.has(changedId)) reconfigureTimerIfIdle();
  updateCameraPresentation();
}

function reconfigureTimerIfIdle() {
  const snapshot = timer.getSnapshot();
  if ([TIMER_STATES.IDLE, TIMER_STATES.COMPLETED].includes(snapshot.state)) {
    rebuildTimer();
  } else {
    pendingSettingsRebuild = true;
    ui.showToast("この変更は次の学習から反映されます");
  }
}

function populateSettingsForm() {
  setValue("setting-attendance", settings.camera.absenceDetectionEnabled);
  setValue("setting-gesture", settings.camera.gestureEnabled);
  setValue("setting-absence-threshold", settings.camera.absenceTimeoutSeconds ?? 0);
  setValue("setting-resume-mode", settings.camera.resumeMode);
  setValue("setting-camera-preview", settings.camera.previewEnabled);
  setValue("setting-notification", settings.notifications.endMethod);
  setValue("setting-volume", settings.notifications.volume);
  setValue("setting-sound", settings.notifications.sound);
  setValue("setting-repeat-alarm", settings.notifications.repeatUntilStopped);
  setValue("setting-gesture-sound", settings.notifications.gestureSoundEnabled);
  setValue("setting-font-size", settings.appearance.fontSize);
  setValue("setting-theme", settings.appearance.theme);
  setValue("setting-clock-format", settings.clock.format);
  setValue("setting-count-up", settings.timer.countUpEnabled);
  setValue("setting-wake-lock", settings.wakeLock.enabled);
  setValue("setting-save-history", settings.history.enabled);
  setValue("setting-pomodoro-study", settings.pomodoro.studyMinutes);
  setValue("setting-pomodoro-short", settings.pomodoro.shortBreakMinutes);
  setValue("setting-pomodoro-long", settings.pomodoro.longBreakMinutes);
  setValue("setting-pomodoro-sets", settings.pomodoro.longBreakEvery);
  setValue("setting-auto-break", settings.pomodoro.autoStartBreak);
  setValue("setting-auto-study", settings.pomodoro.autoStartStudy);
  setValue("exam-no-pause", settings.exam.pauseDisabled);
  setValue("exam-visual-only", settings.exam.visualOnly);

  const capability = getWakeLockCapability();
  const wakeControl = document.getElementById("setting-wake-lock");
  const wakeNote = document.getElementById("wake-lock-note");
  wakeControl.disabled = !capability.supported;
  wakeNote.textContent = capability.supported ? "対応しています" : "この環境では利用できません";

  const vibrationOptions = document.querySelectorAll('select option[value="vibration"]');
  const vibrationNote = document.getElementById("vibration-support-note");
  vibrationOptions.forEach((option) => {
    option.textContent = notifier.vibrationSupported
      ? "バイブレーション"
      : "バイブレーション（画面点滅で代替）";
  });
  vibrationNote.textContent = notifier.vibrationSupported
    ? "このブラウザでは端末のバイブレーションを利用できます。"
    : "このブラウザはバイブレーションに対応していないため、選択時は画面点滅で通知します。";

  const cameraNote = document.getElementById("camera-capability-note");
  if (!window.isSecureContext) cameraNote.textContent = "カメラにはHTTPSまたはlocalhostが必要です。";
  else if (!navigator.mediaDevices?.getUserMedia) cameraNote.textContent = "このブラウザではカメラを利用できません。";
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  if (element.type === "checkbox") element.checked = Boolean(value);
  else element.value = String(value);
}

function renderSubjectsAndQuickTimers() {
  const currentSubject = document.getElementById("session-subject")?.value || subjects[0]?.id || "";
  ui.renderSubjects(subjects, currentSubject);
  const withSubjectNames = quickTimers.map((quick) => ({
    ...quick,
    subjectName: subjects.find((subject) => subject.id === quick.subjectId)?.name || "教科なし"
  }));
  ui.renderQuickTimers(withSubjectNames);
}

function reloadLocalCollections() {
  preferences = loadPreferences();
  settings = preferences.settings;
  subjects = preferences.subjects;
  quickTimers = preferences.quickTimers;
  renderSubjectsAndQuickTimers();
}

async function handleSubjectAction(control) {
  const subject = subjects[Number(control.dataset.subjectIndex)];
  if (!subject) return;
  if (control.dataset.subjectAction === "rename") {
    const name = window.prompt("教科名を編集", subject.name);
    if (name === null) return;
    try {
      updateSubject(subject.id, { name });
      reloadLocalCollections();
    } catch (error) {
      ui.showError(error.message || "教科を編集できませんでした。");
    }
    return;
  }
  if (subjects.length <= 1) {
    ui.showToast("教科は1件以上必要です");
    return;
  }
  const confirmed = await ui.confirm({
    title: `「${subject.name}」を削除しますか？`,
    message: "過去の履歴に保存済みの教科名はそのまま残ります。",
    confirmLabel: "教科を削除"
  });
  if (confirmed) {
    removeSubject(subject.id);
    reloadLocalCollections();
  }
}

function openQuickTimerEditor(index = -1) {
  if (index < 0 && quickTimers.length >= 3) {
    ui.showToast("クイックタイマーは3件までです");
    return;
  }
  const quick = quickTimers[index] || {};
  document.getElementById("quick-timer-index").value = quick.id || "";
  document.getElementById("quick-name").value = quick.name || "";
  document.getElementById("quick-minutes").value = quick.durationMinutes || settings.timer.lastDurationMinutes;
  document.getElementById("quick-subject").value = quick.subjectId || subjects[0]?.id || "";
  document.getElementById("quick-notification").value = quick.notificationMethod || settings.notifications.endMethod;
  document.getElementById("quick-camera").checked = quick.cameraEnabled ?? false;
  document.getElementById("quick-absence").value = String(quick.absenceTimeoutSeconds ?? settings.camera.absenceTimeoutSeconds ?? 0);
  ui.openDialog("quick-timer-dialog");
}

function saveQuickTimerFromDialog(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    ui.closeDialog("quick-timer-dialog", "cancel");
    return;
  }
  try {
    const id = document.getElementById("quick-timer-index").value;
    upsertQuickTimer({
      id: id || undefined,
      name: document.getElementById("quick-name").value,
      durationMinutes: Number(document.getElementById("quick-minutes").value),
      subjectId: document.getElementById("quick-subject").value || null,
      notificationMethod: document.getElementById("quick-notification").value,
      cameraEnabled: document.getElementById("quick-camera").checked,
      absenceTimeoutSeconds: document.getElementById("quick-absence").value === "0"
        ? null
        : Number(document.getElementById("quick-absence").value)
    });
    reloadLocalCollections();
    ui.closeDialog("quick-timer-dialog", "save");
  } catch (error) {
    ui.showError(error.message || "クイックタイマーを保存できませんでした。");
  }
}

async function handleQuickTimerAction(control) {
  const index = Number(control.dataset.quickIndex);
  const quick = quickTimers[index];
  if (!quick) return;
  if (control.dataset.quickAction === "edit") {
    openQuickTimerEditor(index);
    return;
  }
  const confirmed = await ui.confirm({
    title: `「${quick.name}」を削除しますか？`,
    message: "クイックタイマーだけを削除します。学習履歴には影響しません。",
    confirmLabel: "削除"
  });
  if (confirmed) {
    removeQuickTimer(quick.id);
    reloadLocalCollections();
  }
}

async function applyQuickTimer(index) {
  const quick = quickTimers[index];
  if (!quick || !await endActiveSessionForReconfiguration()) return;
  settings = saveSettings({
    timer: { lastMode: TIMER_MODES.COUNTDOWN, lastDurationMinutes: quick.durationMinutes },
    notifications: { endMethod: quick.notificationMethod },
    camera: { absenceTimeoutSeconds: quick.absenceTimeoutSeconds }
  });
  document.getElementById("session-subject").value = quick.subjectId || subjects[0]?.id || "";
  notifier.setMode(settings.notifications.endMethod);
  rebuildTimer();
  ui.setView("timer");
  ui.showToast(`「${quick.name}」を設定しました`);
  if (quick.cameraEnabled && !camera.getSnapshot().active) {
    await enableCameraWithConsent();
  } else if (!quick.cameraEnabled) {
    await disableCamera({ persist: true });
  }
}

async function resetAllPreferences() {
  const activeSnapshot = timer.getSnapshot();
  const hasActiveSession = Boolean(
    activeSnapshot.sessionStartedAt
    && activeSnapshot.state !== TIMER_STATES.COMPLETED
  );
  const confirmed = await ui.confirm({
    title: "設定を初期化しますか？",
    message: hasActiveSession
      ? "現在の学習を途中終了として保存してから、カメラ、通知、表示、教科、クイックタイマーを初期値へ戻します。過去の履歴は残ります。"
      : "カメラ、通知、表示、教科、クイックタイマーを初期値へ戻します。履歴は残ります。",
    confirmLabel: "初期化"
  });
  if (!confirmed) return;
  if (hasActiveSession) timer.finish(Date.now(), { completed: false, force: true });
  notifier.stopAlarm({ reason: "settings-reset" });
  await disableCamera({ persist: false });
  preferences = resetPreferences();
  settings = preferences.settings;
  subjects = preferences.subjects;
  quickTimers = preferences.quickTimers;
  populateSettingsForm();
  notifier.setMode(settings.notifications.endMethod);
  notifier.setVolume(settings.notifications.volume);
  notifier.setSound(settings.notifications.sound);
  ui.applyTheme(settings.appearance);
  renderSubjectsAndQuickTimers();
  rebuildTimer();
  ui.showToast("設定を初期化しました");
}

async function deleteAllHistory() {
  const confirmed = await ui.confirm({
    title: "すべての履歴を削除しますか？",
    message: "この操作は取り消せません。設定とクイックタイマーは残ります。",
    confirmLabel: "全履歴を削除"
  });
  if (!confirmed) return;
  await clearSessions();
  await refreshHistory();
  ui.showToast("学習履歴を削除しました");
}

function bindDialogs() {
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => ui.closeDialog(button.dataset.closeDialog));
  });
  document.getElementById("camera-calibration-dialog").addEventListener("close", syncPreviewStreams);
  document.getElementById("finish-camera-calibration").addEventListener("click", () => {
    settings = saveSettings({ camera: { calibrated: true } });
    ui.closeDialog("camera-calibration-dialog", "done");
    ui.showToast("カメラ位置を保存しました");
  });
  document.getElementById("disable-camera-from-calibration").addEventListener("click", () => {
    void disableCamera({ persist: true });
    ui.closeDialog("camera-calibration-dialog", "disabled");
  });

  document.getElementById("absence-resume-dialog").addEventListener("close", (event) => {
    const resume = event.currentTarget.returnValue === "resume";
    const now = Date.now();
    if (resume) {
      timer.resumeFromAbsence(now);
      attendance.acknowledgeReturn({ resume: true, now });
      ui.showToast("学習を再開しました");
    } else {
      timer.resumeFromAbsence(now);
      timer.pause(now, { force: true });
      attendance.acknowledgeReturn({ resume: false, now });
      attendance.setMonitoring(false, { now, forceReset: true, reason: "kept_paused" });
    }
  });

  document.getElementById("background-dialog").addEventListener("close", (event) => {
    const continued = event.currentTarget.returnValue === "continued";
    timer.resolveBackground(continued, Date.now());
    attendance.reset({ monitoring: false });
    updateRuntimeActivity(timer.getSnapshot());
    ui.showToast(continued ? "画面外の時間も学習に含めました" : "画面外の時間を学習から除外しました");
  });

  document.getElementById("break-dialog").addEventListener("close", (event) => {
    if (event.currentTarget.returnValue === "end-break") {
      timer.skipBreak(Date.now());
      ui.showToast("休憩を終了しました");
    }
  });

  document.getElementById("finish-dialog").addEventListener("close", (event) => {
    if (event.currentTarget.returnValue !== "finish") return;
    const memo = document.getElementById("finish-memo").value.trim();
    document.getElementById("session-memo").value = memo;
    activeSessionMetadata = { ...(activeSessionMetadata || captureSessionMetadata()), memo };
    timer.finish(Date.now(), { force: true });
  });

  const alarmDialog = document.getElementById("alarm-dialog");
  alarmDialog.addEventListener("cancel", (event) => event.preventDefault());
  document.getElementById("stop-alarm-button").addEventListener("click", () => {
    notifier.stopAlarm({ reason: "user" });
  });
}

async function enableCameraWithConsent() {
  if (!settings.camera.privacyAcknowledged) {
    const choice = await ui.waitForDialog("camera-consent-dialog");
    if (choice !== "confirm") return false;
    settings = saveSettings({ camera: { privacyAcknowledged: true } });
  }
  return startCamera();
}

async function startCamera() {
  const calibrationDialog = ui.openDialog("camera-calibration-dialog");
  document.getElementById("camera-start-error").textContent = "";
  ui.renderCalibration({ face: "準備中", hand: "準備中", brightness: "計測中", advice: "モデルを読み込んでいます" });
  try {
    await camera.start({
      videoElement: document.getElementById("camera-video"),
      handEnabled: settings.camera.gestureEnabled
    });
    try {
      await camera.setHandEnabled(settings.camera.gestureEnabled);
    } catch (error) {
      console.error("[Focus Lens] hand model synchronization failed", error);
      ui.showError(`${error.message || "手の検出を開始できませんでした。"} 顔検出のみで続行します。`);
    }
    settings = saveSettings({ camera: { enabled: true } });
    if (!calibrationDialog?.open) ui.openDialog("camera-calibration-dialog");
    syncPreviewStreams();
    updateCameraPresentation();
    return true;
  } catch (error) {
    if (error?.code === "START_CANCELLED") {
      updateCameraPresentation();
      return false;
    }
    console.error("[Focus Lens] camera start failed", error);
    const message = `${error.message || "カメラを開始できませんでした。"} 通常のタイマーは使用できます。`;
    document.getElementById("camera-start-error").textContent = message;
    ui.showError(message);
    updateCameraPresentation();
    return false;
  }
}

async function disableCamera({ persist = true } = {}) {
  const releasedState = releaseTimerFromCameraDependency(Date.now());
  await camera.stop();
  attendance.reset({ monitoring: false });
  detachPreviewStreams();
  if (persist) settings = saveSettings({ camera: { enabled: false } });
  updateCameraPresentation();
  if (releasedState === "paused") {
    ui.showToast("カメラを停止し、タイマーを一時停止しました");
  }
}

function releaseTimerFromCameraDependency(now = Date.now()) {
  if (!timer) return null;
  const hadCandidate = Boolean(timer.getSnapshot().absenceCandidate);
  if (hadCandidate) {
    timer.reportFacePresent(now);
  }
  const snapshot = timer.getSnapshot();
  if (snapshot.state === TIMER_STATES.ABSENCE_PAUSED) {
    ui.closeDialog("absence-resume-dialog", "camera-unavailable");
    timer.resumeFromAbsence(now, { force: true });
    timer.pause(now, { force: true });
    attendance.reset({ monitoring: false });
    return "paused";
  }
  return hadCandidate ? "candidate_cancelled" : null;
}

function setPreviewStream(id, enabled) {
  const video = document.getElementById(id);
  if (!video) return;
  const stream = enabled ? camera.stream : null;
  if (video.srcObject === stream) return;
  if (!stream) {
    video.pause();
    video.srcObject = null;
    return;
  }
  video.srcObject = stream;
  video.play().catch(() => undefined);
}

function syncPreviewStreams() {
  const cameraSnapshot = camera.getSnapshot();
  const active = Boolean(camera.stream)
    && ![CAMERA_STATES.IDLE, CAMERA_STATES.STOPPING, CAMERA_STATES.ERROR].includes(cameraSnapshot.state)
    && document.visibilityState === "visible";
  const settingsVisible = !document.getElementById("settings-view").hidden;
  const calibrationOpen = document.getElementById("camera-calibration-dialog").open;
  setPreviewStream("camera-calibration-preview", active && calibrationOpen);
  setPreviewStream(
    "settings-camera-preview",
    active && settingsVisible && !calibrationOpen && settings.camera.previewEnabled
  );
  setPreviewStream(
    "debug-camera-preview",
    active && settingsVisible && !calibrationOpen && debugEnabled && !document.getElementById("debug-panel").hidden
  );
  ui.setCameraPreviewVisible(settings.camera.previewEnabled && active);
}

function detachPreviewStreams() {
  ["camera-calibration-preview", "settings-camera-preview", "debug-camera-preview"].forEach((id) => {
    setPreviewStream(id, false);
  });
  ui.setCameraPreviewVisible(false);
}

function bindCameraEvents() {
  camera.addEventListener("state", (event) => {
    updateCameraPresentation(event.detail.snapshot);
    syncPreviewStreams();
  });
  camera.addEventListener("face", (event) => {
    latestFace = event.detail;
    const snapshot = timer.getSnapshot();
    if (snapshot.background) {
      updateCameraPresentation();
      drawDebugCameraOverlay();
      return;
    }
    attendance.update(latestFace, {
      now: Date.now(),
      monitoring: shouldMonitorAttendance(snapshot),
      isBreak: snapshot.state === TIMER_STATES.BREAK
    });
    updateCameraPresentation();
    drawDebugCameraOverlay();
  });
  camera.addEventListener("hand", (event) => {
    latestHand = event.detail;
    updateCameraPresentation();
    drawDebugCameraOverlay();
  });
  camera.addEventListener("gesture", () => {
    if (document.querySelector("dialog[open]")) return;
    void handlePalmGesture();
  });
  camera.addEventListener("metrics", (event) => {
    latestCameraMetrics = event.detail;
    updateCalibrationPresentation();
    if (debugEnabled) updateDebugReadout();
  });
  camera.addEventListener("error", (event) => {
    console.error("[Focus Lens] camera processing error", event.detail.error || event.detail);
    if (event.detail.recoverable === false || camera.getSnapshot().state === CAMERA_STATES.ERROR) {
      releaseTimerFromCameraDependency(Date.now());
    }
    const message = event.detail.message || "カメラ解析で問題が発生しました。";
    ui.showError(`${message} 通常のタイマーは引き続き使用できます。`);
    updateCameraPresentation();
  });
}

function bindAttendanceEvents() {
  attendance.addEventListener("candidate", (event) => {
    timer.reportFaceMissing(event.detail.absenceDetectedAt);
  });
  attendance.addEventListener("pending", () => {
    timer.tick(Date.now());
    updateCameraPresentation();
  });
  attendance.addEventListener("pause", (event) => {
    // The synthetic debug path can reach pause without a separate candidate.
    if (!timer.getSnapshot().absenceCandidate) timer.reportFaceMissing(event.detail.absenceDetectedAt);
    timer.tick(Date.now());
  });
  attendance.addEventListener("return", (event) => {
    timer.reportFacePresent(event.detail.returnedAt || Date.now());
  });
  attendance.addEventListener("cancel", (event) => {
    timer.reportFacePresent(event.detail.returnedAt || Date.now());
  });
  attendance.addEventListener("statechange", () => updateCameraPresentation());
}

async function handlePalmGesture() {
  const snapshot = timer.getSnapshot();
  if (snapshot.state === TIMER_STATES.BREAK) {
    if (settings.notifications.gestureSoundEnabled) await notifier.playGestureTone({ enabled: true });
    ui.openDialog("break-dialog");
    return;
  }
  await toggleTimer("gesture");
}

function updateRuntimeActivity(snapshot) {
  const advancing = ACTIVE_STATES.has(snapshot.state);
  camera.setActivity({
    timerRunning: advancing,
    isBreak: snapshot.state === TIMER_STATES.BREAK
  });
  attendance.setMonitoring(shouldMonitorAttendance(snapshot), {
    now: Date.now(),
    reason: "timer_state"
  });
  wakeLock.setRunning(Boolean(settings.wakeLock.enabled && (advancing || notifier.isAlarmActive)));
}

function updateCameraPresentation(cameraSnapshot = camera.getSnapshot()) {
  const attendanceSnapshot = attendance.getSnapshot();
  const timerSnapshot = timer?.getSnapshot();
  let label = "停止中";
  if (cameraSnapshot.state === CAMERA_STATES.REQUESTING) label = "カメラ許可を確認中";
  else if (cameraSnapshot.state === CAMERA_STATES.LOADING) label = "検出モデルを準備中";
  else if (cameraSnapshot.state === CAMERA_STATES.SUSPENDED) label = "画面外のため検出停止";
  else if (cameraSnapshot.state === CAMERA_STATES.ERROR) label = "カメラが使用できません";
  else if (cameraSnapshot.active) {
    if (timerSnapshot?.state === TIMER_STATES.ABSENCE_PAUSED) label = "離席により一時停止";
    else if (attendanceSnapshot.state === ATTENDANCE_STATES.PENDING) label = "離席判定中";
    else if (latestHand?.openPalm) label = "手のひらを検出";
    else if (latestFace?.state === "present") label = "顔を検出中";
    else if (latestFace?.state === "absent") label = "顔を確認できません";
    else label = "顔を確認中";
  }

  let advice = "";
  if (cameraSnapshot.brightness === "dark") advice = "暗い場所では検出精度が下がります。照明を少し明るくしてください。";
  if (cameraSnapshot.brightness === "possibly_blocked") advice = "カメラが暗い、または塞がれている可能性があります。";
  ui.setCameraState({
    active: cameraSnapshot.active,
    label,
    advice,
    handDetected: Boolean(
      settings.camera.gestureEnabled
      && cameraSnapshot.handEnabled
      && cameraSnapshot.models?.hand
    )
  });
  ui.setCameraPreviewVisible(settings.camera.previewEnabled && cameraSnapshot.active);
  updateCalibrationPresentation();
}

function updateCalibrationPresentation() {
  const snapshot = camera.getSnapshot();
  const faceLabel = latestFace?.state === "present" ? "正常" : latestFace?.state === "absent" ? "確認できません" : "確認中";
  let handLabel = "確認中";
  if (!settings.camera.gestureEnabled) handLabel = "OFF";
  else if (snapshot.active && (!snapshot.handEnabled || !snapshot.models?.hand)) handLabel = "利用できません";
  else if (latestHand?.detected) handLabel = latestHand.openPalm ? "手のひら：正常" : "手を検出";
  const lightLabel = snapshot.brightness === "normal" ? "正常" : snapshot.brightness === "dark" ? "やや暗い" : snapshot.brightness === "possibly_blocked" ? "暗すぎます" : "計測中";
  let advice = "顔全体が収まるよう、iPhoneを少し上向きにしてください";
  if (snapshot.brightness === "dark") advice = "照明を明るくするか、iPhoneの向きを調整してください";
  if (snapshot.brightness === "possibly_blocked") advice = "カメラを覆っているものがないか確認してください";
  if (latestFace?.state === "present" && snapshot.brightness === "normal") advice = "この位置で使用できます";
  ui.renderCalibration({ face: faceLabel, hand: handLabel, brightness: lightLabel, advice });
}

function notificationOptions() {
  return {
    mode: settings.notifications.endMethod,
    volume: settings.notifications.volume,
    sound: settings.notifications.sound,
    fallbackToFlash: true
  };
}

function notifyTimerCompletion(title = "時間になりました") {
  const options = currentSnapshot?.mode === TIMER_MODES.EXAM && settings.exam.visualOnly
    ? { ...notificationOptions(), mode: "flash" }
    : notificationOptions();
  startCompletionNotification("complete", title, options);
}

function startCompletionNotification(eventName, title, suppliedOptions = null) {
  const options = suppliedOptions || notificationOptions();
  const repeats = Boolean(settings.notifications.repeatUntilStopped && options.mode !== "silent");

  if (!repeats) {
    void notifier.notifyEvent(eventName, options).then((result) => {
      if (!result.sounded && !result.vibrated && !result.flashed && options.mode !== "silent") {
        ui.showToast("通知を再生できなかったため、完了表示でお知らせします");
      }
    });
    return;
  }

  document.getElementById("alarm-title").textContent = title;
  document.getElementById("alarm-message").textContent = notifier.vibrationSupported
    ? "停止ボタンを押すまで通知を繰り返します。"
    : "停止ボタンを押すまで通知を繰り返します。バイブレーション非対応時は画面を点滅します。";
  notifier.stopAlarm({ reason: "replaced" });
  ui.openDialog("alarm-dialog");
  void notifier.startAlarm(eventName, { ...options, repeat: true }).then((result) => {
    if (!result.sounded && !result.vibrated && !result.flashed && notifier.isAlarmActive) {
      ui.showToast("音声が制限されています。停止ボタンは画面に表示されています。", 3600);
    }
  });
}

function captureSessionMetadata() {
  const subjectId = document.getElementById("session-subject").value || null;
  const subject = subjects.find((item) => item.id === subjectId);
  return {
    subjectId,
    subjectName: subject?.name || null,
    memo: document.getElementById("session-memo").value.trim()
  };
}

async function persistCompletedSession(snapshot) {
  if (!settings.history.enabled || !snapshot?.sessionId || sessionSaveInFlight.has(snapshot.sessionId)) return;
  if (!snapshot.sessionStartedAt || snapshot.stats.actualStudyMs < 1000) return;
  sessionSaveInFlight.add(snapshot.sessionId);
  try {
    const metadata = activeSessionMetadata || captureSessionMetadata();
    await saveSession(snapshot, {
      ...metadata,
      memo: document.getElementById("session-memo").value.trim()
    });
    await refreshHistory();
  } catch (error) {
    sessionSaveInFlight.delete(snapshot.sessionId);
    ui.showError("学習履歴を保存できませんでした。タイマー自体は引き続き使用できます。");
    console.error("[Focus Lens] history save failed", error);
  }
}

async function refreshHistory() {
  const records = await listSessions();
  const summary = buildHistorySummary(records);
  const subjectTotals = {};
  summary.bySubject.forEach((item) => {
    const key = item.subjectName || "未設定";
    subjectTotals[key] = (subjectTotals[key] || 0) + item.actualStudyMs;
  });
  ui.renderHistory({
    todayMs: summary.today.actualStudyMs,
    weekMs: summary.week.actualStudyMs,
    completionRate: records.length ? summary.completionRate : Number.NaN,
    absenceMs: summary.all.absenceMs,
    subjectTotals
  }, records);
}

function bindLifecycle() {
  document.addEventListener("visibilitychange", () => {
    const snapshot = timer.getSnapshot();
    if (document.visibilityState === "hidden") {
      notifier.suspendAlarm();
      if (ACTIVE_STATES.has(snapshot.state)) timer.enterBackground(Date.now());
      if (snapshot.state !== TIMER_STATES.ABSENCE_PAUSED) {
        attendance.reset({ monitoring: false });
      }
    } else if (snapshot.background) {
      timer.leaveBackground(Date.now());
    }
    if (document.visibilityState === "visible") {
      notifier.bindUnlock(document);
      notifier.refreshAlarm();
      updateRuntimeActivity(timer.getSnapshot());
    }
  });
  window.addEventListener("pagehide", () => {
    const snapshot = timer.getSnapshot();
    if (ACTIVE_STATES.has(snapshot.state) && !snapshot.background) {
      timer.enterBackground(Date.now());
    }
    releaseTimerFromCameraDependency(Date.now());
    notifier.suspendAlarm();
    attendance.reset({ monitoring: false });
    camera.stop().catch(() => undefined);
    wakeLock.release("pagehide").catch(() => undefined);
  });
  window.addEventListener("pageshow", () => {
    const snapshot = timer.getSnapshot();
    if (snapshot.background && document.visibilityState === "visible") {
      timer.leaveBackground(Date.now());
    }
    if (document.visibilityState === "visible") {
      notifier.bindUnlock(document);
      notifier.refreshAlarm();
      updateRuntimeActivity(timer.getSnapshot());
    }
  });
}

function bindErrorHandling() {
  notifier.addEventListener("alarmstart", () => updateRuntimeActivity(timer.getSnapshot()));
  notifier.addEventListener("alarmstop", () => {
    const dialog = document.getElementById("alarm-dialog");
    if (dialog.open) ui.closeDialog("alarm-dialog", "stopped");
    updateRuntimeActivity(timer.getSnapshot());
  });
  notifier.addEventListener("error", (event) => {
    console.warn("[Focus Lens] notification fallback", event.detail.error || event.detail);
  });
  wakeLock.addEventListener("error", (event) => {
    console.error("[Focus Lens] wake lock failed", event.detail.error || event.detail);
    ui.showError("画面の点灯状態を維持できませんでした。タイマーはそのまま使用できます。");
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Focus Lens] unhandled promise rejection", event.reason);
  });
}

function bindDebugControls() {
  debugTools.wireEvents({
    root: document.getElementById("debug-panel"),
    handlers: {
      "face-present": () => camera.simulateFace(true, { samples: 14 }),
      "face-absent": () => camera.simulateFace(false, { samples: 14 }),
      "absence-30": () => attendance.simulateAbsence(
        (settings.camera.absenceTimeoutSeconds ?? 30) * 1000,
        { now: Date.now(), monitoring: true }
      ),
      palm: () => camera.simulateGesture({ force: true, latch: false }),
      "camera-error": () => ui.showError("デバッグ：カメラエラーを再現しました。通常タイマーは継続できます。"),
      background: () => {
        if (!ACTIVE_STATES.has(timer.getSnapshot().state)) timer.start(Date.now());
        timer.enterBackground(Date.now() - 5_000);
        timer.leaveBackground(Date.now());
      },
      complete: () => timer.finish(Date.now(), { completed: true, force: true })
    }
  });
}

function updateDebugReadout() {
  if (!debugEnabled) return;
  const snapshot = createDebugSnapshot({
    timer: timer.getSnapshot(),
    camera: camera.getDebugSnapshot(),
    attendance: attendance.getSnapshot(),
    face: latestFace,
    hand: latestHand,
    metrics: latestCameraMetrics,
    visibilityState: document.visibilityState
  });
  ui.updateDebug(snapshot);
}

function drawDebugCameraOverlay() {
  if (!debugEnabled) return;
  const sourceVideo = camera.getVideoElement();
  const data = {
    faceBox: latestFace?.boundingBox,
    handLandmarks: latestHand?.bestHand?.landmarks,
    sourceWidth: sourceVideo?.videoWidth,
    sourceHeight: sourceVideo?.videoHeight
  };
  ["camera-overlay", "debug-overlay"].forEach((id) => {
    const canvas = document.getElementById(id);
    if (!canvas || !sourceVideo?.videoWidth) return;
    canvas.width = sourceVideo.videoWidth;
    canvas.height = sourceVideo.videoHeight;
    debugTools.draw(canvas, data, { mirrored: false });
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch((error) => {
      console.info("[Focus Lens] service worker unavailable", error);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
