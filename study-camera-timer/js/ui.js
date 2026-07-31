"use strict";

const TIMER_STATE_LABELS = Object.freeze({
  idle: "待機中",
  running: "計測中",
  paused: "一時停止中",
  absence_pending: "離席判定中",
  absence_paused: "離席により一時停止",
  break: "休憩中",
  completed: "完了",
  camera_error: "カメラエラー"
});

const MODE_LABELS = Object.freeze({
  countdown: "カウントダウン",
  stopwatch: "ストップウォッチ",
  pomodoro: "ポモドーロ",
  exam: "試験"
});

const NOTIFICATION_LABELS = Object.freeze({
  sound: "音",
  vibrate: "バイブレーション",
  vibration: "バイブレーション",
  flash: "画面点滅",
  "sound-flash": "音＋画面点滅",
  sound_flash: "音＋画面点滅",
  silent: "無音"
});

export function formatDuration(milliseconds, { alwaysHours = false } = {}) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0 || alwaysHours) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatCompactDuration(milliseconds) {
  const minutes = Math.max(0, Math.round(Number(milliseconds || 0) / 60000));
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}時間${remainder}分` : `${hours}時間`;
}

export function formatClock(date = new Date(), format = "24") {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: String(format) === "12" || String(format) === "12h"
  }).format(date);
}

export function formatDateLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString || "日付不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

export function getStateLabel(state) {
  return TIMER_STATE_LABELS[state] || "待機中";
}

export class UIController {
  constructor(root = document) {
    this.root = root;
    this.toastTimer = 0;
    this.clockTimer = 0;
    this.confirmAction = null;
    this.elements = this.#collectElements();
  }

  #collectElements() {
    const byId = (id) => this.root.getElementById(id);
    return {
      clock: byId("current-clock"),
      timerDisplay: byId("timer-display"),
      timerCaption: byId("timer-caption"),
      timerProgress: byId("timer-progress"),
      progressTrack: this.root.querySelector(".progress-track"),
      timerStatus: byId("timer-status"),
      cameraStatus: byId("camera-status"),
      cameraAdvice: byId("camera-advice"),
      cameraIndicator: byId("camera-live-indicator"),
      absenceCountdown: byId("absence-countdown"),
      absenceSeconds: byId("absence-seconds"),
      overtime: byId("overtime-display"),
      startPause: byId("start-pause-button"),
      startPauseLabel: byId("start-pause-label"),
      reset: byId("reset-button"),
      repeat: byId("repeat-button"),
      finish: byId("finish-button"),
      durationPicker: byId("duration-picker"),
      configuredDuration: byId("configured-duration"),
      presetButtons: byId("preset-buttons"),
      customMinutes: byId("custom-minutes"),
      pomodoroSummary: byId("pomodoro-summary"),
      pomodoroPhase: byId("pomodoro-phase"),
      pomodoroSet: byId("pomodoro-set"),
      pomodoroNext: byId("pomodoro-next"),
      examTools: byId("exam-tools"),
      examDisplayToggle: byId("exam-display-toggle"),
      examLockToggle: byId("exam-lock-toggle"),
      quickStrip: byId("quick-timer-strip"),
      sessionSubject: byId("session-subject"),
      sessionMemo: byId("session-memo"),
      todayTotal: byId("today-total"),
      errorBanner: byId("error-banner"),
      errorText: byId("error-banner-text"),
      toastRegion: byId("toast-region"),
      cameraAssistCopy: byId("camera-assist-copy"),
      cameraAssistButton: byId("camera-assist-button"),
      settingsCameraAction: byId("settings-camera-action"),
      settingsCameraPreviewWrap: byId("settings-camera-preview-wrap"),
      calibrationFace: byId("calibration-face"),
      calibrationHand: byId("calibration-hand"),
      calibrationLight: byId("calibration-light"),
      calibrationAdvice: byId("calibration-advice"),
      historyToday: byId("history-today"),
      historyWeek: byId("history-week"),
      historyCompletion: byId("history-completion"),
      historyAbsence: byId("history-absence"),
      subjectTotals: byId("subject-totals"),
      historyList: byId("history-list"),
      quickSettings: byId("quick-timer-settings"),
      subjectSettings: byId("subject-settings"),
      quickSubject: byId("quick-subject"),
      debugPanel: byId("debug-panel"),
      debugReadout: byId("debug-readout")
    };
  }

  startClock(getFormat = () => "24") {
    window.clearInterval(this.clockTimer);
    const update = () => {
      this.elements.clock.textContent = formatClock(new Date(), getFormat());
    };
    update();
    this.clockTimer = window.setInterval(update, 1000);
  }

  setView(name) {
    this.root.querySelectorAll(".view").forEach((view) => {
      const active = view.dataset.view === name;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
    });
    this.root.querySelectorAll("[data-view-target]").forEach((button) => {
      const active = button.dataset.viewTarget === name;
      button.classList.toggle("is-active", active);
      active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  setMode(mode) {
    this.root.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    this.elements.pomodoroSummary.hidden = mode !== "pomodoro";
    this.elements.examTools.hidden = mode !== "exam";
    this.elements.durationPicker.hidden = mode === "stopwatch" || mode === "pomodoro";
  }

  renderTimer(viewModel) {
    const {
      display = "25:00",
      caption = "残り時間",
      progress = 0,
      state = "idle",
      statusLabel = getStateLabel(state),
      overtimeMs = 0,
      showOvertime = false,
      startLabel = "開始",
      startIcon = "▶",
      canReset = true,
      canRepeat = false,
      canFinish = false,
      configuredMinutes,
      pomodoro,
      examDisplay = "remaining",
      examLocked = false
    } = viewModel;

    this.elements.timerDisplay.textContent = display;
    this.elements.timerCaption.textContent = caption;
    const safeProgress = Math.max(0, Math.min(100, Number(progress || 0)));
    this.elements.timerProgress.style.width = `${safeProgress}%`;
    this.elements.progressTrack.setAttribute("aria-valuenow", String(Math.round(safeProgress)));
    this.elements.timerStatus.textContent = statusLabel;
    this.elements.overtime.hidden = !showOvertime;
    this.elements.overtime.textContent = `超過 ${formatDuration(overtimeMs)}`;
    this.elements.startPauseLabel.textContent = startLabel;
    const icon = this.elements.startPause.querySelector("span[aria-hidden]");
    if (icon) icon.textContent = startIcon;
    this.elements.reset.disabled = !canReset;
    this.elements.repeat.disabled = !canRepeat;
    this.elements.finish.disabled = !canFinish;

    if (Number.isFinite(configuredMinutes)) {
      this.elements.configuredDuration.textContent = `設定 ${configuredMinutes}分`;
      this.elements.customMinutes.value = String(configuredMinutes);
    }

    if (pomodoro) {
      this.elements.pomodoroPhase.textContent = `現在：${pomodoro.phaseLabel}`;
      this.elements.pomodoroSet.textContent = `${pomodoro.currentSet} / ${pomodoro.totalSets}セット`;
      this.elements.pomodoroNext.textContent = `次：${pomodoro.nextLabel}`;
    }

    this.elements.examDisplayToggle.textContent = examDisplay === "elapsed" ? "表示：経過時間" : "表示：残り時間";
    this.elements.examLockToggle.innerHTML = examLocked
      ? '<span aria-hidden="true">◆</span> 長押しして解除'
      : '<span aria-hidden="true">◇</span> 操作をロック';
    document.body.classList.toggle("exam-locked", Boolean(examLocked));
  }

  renderPresets(values, activeMinutes) {
    const fragment = document.createDocumentFragment();
    values.forEach((minutes) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-button";
      button.dataset.minutes = String(minutes);
      button.textContent = `${minutes}分`;
      button.classList.toggle("is-active", Number(activeMinutes) === Number(minutes));
      button.setAttribute("aria-pressed", String(Number(activeMinutes) === Number(minutes)));
      fragment.append(button);
    });
    this.elements.presetButtons.replaceChildren(fragment);
  }

  setAbsencePending({ active, remainingSeconds = 0 }) {
    this.elements.absenceCountdown.hidden = !active;
    this.elements.absenceSeconds.textContent = String(Math.max(0, Math.ceil(remainingSeconds)));
  }

  setCameraState({ active = false, label = "停止中", advice = "", handDetected = false } = {}) {
    this.elements.cameraStatus.textContent = label;
    this.elements.cameraIndicator.hidden = !active;
    this.elements.cameraAdvice.hidden = !advice;
    this.elements.cameraAdvice.textContent = advice;
    this.elements.cameraAssistCopy.textContent = active
      ? (handDetected ? "顔と手のひらを端末内で確認しています。" : "顔を端末内で確認しています。")
      : "カメラは停止中です。通常の学習タイマーとしてそのまま使えます。";
    this.elements.cameraAssistButton.querySelector("span:last-child").textContent = active ? "カメラを調整" : "カメラ補助を使う";
    this.elements.settingsCameraAction.textContent = active ? "OFFにする" : "有効にする";
  }

  renderCalibration({ face, hand, brightness, advice } = {}) {
    if (face) this.elements.calibrationFace.textContent = face;
    if (hand) this.elements.calibrationHand.textContent = hand;
    if (brightness) this.elements.calibrationLight.textContent = brightness;
    if (advice) this.elements.calibrationAdvice.textContent = advice;
  }

  renderSubjects(subjects, selected = "") {
    const normalized = subjects.map((subject, index) => typeof subject === "string"
      ? { id: subject, name: subject }
      : { id: String(subject.id ?? index), name: String(subject.name ?? "") });
    const makeOptions = () => normalized.map((subject) => {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      return option;
    });
    [this.elements.sessionSubject, this.elements.quickSubject].forEach((select) => {
      const previous = select === this.elements.sessionSubject ? (selected || select.value) : select.value;
      select.replaceChildren(...makeOptions());
      if (normalized.some((subject) => subject.id === previous)) select.value = previous;
    });

    const rows = normalized.map((subject, index) => {
      const row = document.createElement("div");
      row.className = "editable-row";
      const text = document.createElement("p");
      text.textContent = subject.name;
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const rename = document.createElement("button");
      rename.type = "button";
      rename.dataset.subjectAction = "rename";
      rename.dataset.subjectIndex = String(index);
      rename.textContent = "編集";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-action";
      remove.dataset.subjectAction = "remove";
      remove.dataset.subjectIndex = String(index);
      remove.textContent = "削除";
      actions.append(rename, remove);
      row.append(text, actions);
      return row;
    });
    this.elements.subjectSettings.replaceChildren(...rows);
  }

  renderQuickTimers(quickTimers) {
    const chips = quickTimers.map((timer, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-chip";
      button.dataset.quickIndex = String(index);
      button.append(document.createTextNode(timer.name || `タイマー${index + 1}`));
      const detail = document.createElement("span");
      detail.textContent = ` ${timer.durationMinutes ?? timer.minutes}分`;
      button.append(detail);
      return button;
    });
    this.elements.quickStrip.replaceChildren(...chips);

    const rows = quickTimers.map((timer, index) => {
      const row = document.createElement("div");
      row.className = "editable-row";
      const text = document.createElement("p");
      text.textContent = timer.name || `タイマー${index + 1}`;
      const meta = document.createElement("span");
      const minutes = timer.durationMinutes ?? timer.minutes;
      const subject = timer.subjectName || timer.subject || "教科なし";
      const notification = timer.notificationMethod || timer.notification;
      meta.textContent = `${minutes}分・${subject}・${NOTIFICATION_LABELS[notification] || "通知"}`;
      text.append(meta);
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.dataset.quickAction = "edit";
      edit.dataset.quickIndex = String(index);
      edit.textContent = "編集";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-action";
      remove.dataset.quickAction = "remove";
      remove.dataset.quickIndex = String(index);
      remove.textContent = "削除";
      actions.append(edit, remove);
      row.append(text, actions);
      return row;
    });
    this.elements.quickSettings.replaceChildren(...rows);
  }

  renderHistory(summary = {}, records = []) {
    this.elements.historyToday.textContent = formatCompactDuration(summary.todayMs || 0);
    this.elements.historyWeek.textContent = formatCompactDuration(summary.weekMs || 0);
    this.elements.historyCompletion.textContent = Number.isFinite(summary.completionRate)
      ? `${Math.round(summary.completionRate * 100)}%`
      : "—";
    this.elements.historyAbsence.textContent = formatCompactDuration(summary.absenceMs || 0);
    this.elements.todayTotal.textContent = formatCompactDuration(summary.todayMs || 0);
    this.#renderSubjectTotals(summary.subjectTotals || {});
    this.#renderHistoryList(records);
  }

  #renderSubjectTotals(subjectTotals) {
    const entries = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "履歴ができると、教科別の時間を表示します。";
      this.elements.subjectTotals.replaceChildren(empty);
      return;
    }
    const max = Math.max(...entries.map(([, value]) => value), 1);
    const rows = entries.map(([subject, milliseconds]) => {
      const row = document.createElement("div");
      row.className = "subject-bar";
      const label = document.createElement("span");
      label.textContent = subject;
      const track = document.createElement("div");
      track.className = "subject-bar-track";
      const value = document.createElement("span");
      value.style.width = `${Math.max(3, milliseconds / max * 100)}%`;
      track.append(value);
      const total = document.createElement("strong");
      total.textContent = formatCompactDuration(milliseconds);
      row.append(label, track, total);
      return row;
    });
    this.elements.subjectTotals.replaceChildren(...rows);
  }

  #renderHistoryList(records) {
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "まだ履歴はありません。最初の学習を始めましょう。";
      this.elements.historyList.replaceChildren(empty);
      return;
    }
    const grouped = new Map();
    records.forEach((record) => {
      const key = record.date || new Date(record.startedAt || Date.now()).toISOString().slice(0, 10);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(record);
    });
    const days = [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => {
      const section = document.createElement("section");
      section.className = "history-day";
      const heading = document.createElement("div");
      heading.className = "history-day-heading";
      const title = document.createElement("h4");
      title.textContent = formatDateLabel(date);
      const total = document.createElement("strong");
      total.textContent = formatCompactDuration(items.reduce((sum, item) => sum + Number(item.actualStudyMs || 0), 0));
      heading.append(title, total);
      section.append(heading);
      items.sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0)).forEach((record) => {
        const item = document.createElement("article");
        item.className = "history-item";
        const time = document.createElement("time");
        time.className = "history-time";
        time.textContent = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(record.startedAt || Date.now()));
        const detail = document.createElement("div");
        detail.className = "history-detail";
        const subject = document.createElement("strong");
        subject.textContent = record.subjectName || record.subject || "教科なし";
        const meta = document.createElement("span");
        const mode = MODE_LABELS[record.mode] || record.mode || "タイマー";
        const state = record.completed ? "完了" : "途中終了";
        const configured = record.configuredDurationMs !== null
          && record.configuredDurationMs !== undefined
          && Number.isFinite(Number(record.configuredDurationMs))
          ? `・設定 ${formatCompactDuration(record.configuredDurationMs)}`
          : "";
        meta.textContent = `${mode}・${state}${configured}${record.memo ? `・${record.memo}` : ""}`;
        const metrics = document.createElement("span");
        metrics.textContent = [
          `離席 ${formatDuration(record.absenceMs || 0)}／${Number(record.absenceCount || 0)}回`,
          `手動停止 ${formatDuration(record.manualPauseMs || 0)}／${Number(record.pauseCount || 0)}回`,
          Number(record.breakMs || 0) > 0 ? `休憩 ${formatDuration(record.breakMs)}` : ""
        ].filter(Boolean).join("・");
        detail.append(subject, meta, metrics);
        const duration = document.createElement("div");
        duration.className = "history-duration";
        const study = document.createElement("strong");
        study.textContent = formatDuration(record.actualStudyMs || 0, {
          alwaysHours: Number(record.actualStudyMs || 0) >= 3_600_000
        });
        const absence = document.createElement("small");
        absence.textContent = "実学習";
        duration.append(study, absence);
        item.append(time, detail, duration);
        section.append(item);
      });
      return section;
    });
    this.elements.historyList.replaceChildren(...days);
  }

  applyTheme(settings) {
    document.documentElement.dataset.theme = settings.theme || "system";
    document.documentElement.dataset.fontSize = settings.fontSize || "medium";
    const themeMeta = this.root.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = settings.theme === "dark" ? "#171b1a" : "#f4f5f3";
  }

  setCameraPreviewVisible(visible) {
    this.elements.settingsCameraPreviewWrap.hidden = !visible;
  }

  setDebugVisible(visible) {
    this.elements.debugPanel.hidden = !visible;
  }

  updateDebug(snapshot) {
    this.elements.debugReadout.textContent = typeof snapshot === "string"
      ? snapshot
      : JSON.stringify(snapshot, null, 2);
  }

  showToast(message, duration = 2200) {
    window.clearTimeout(this.toastTimer);
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.elements.toastRegion.replaceChildren(toast);
    this.toastTimer = window.setTimeout(() => this.elements.toastRegion.replaceChildren(), duration);
  }

  showError(message) {
    console.error("[Focus Lens]", message);
    this.elements.errorText.textContent = message;
    this.elements.errorBanner.hidden = false;
  }

  clearError() {
    this.elements.errorBanner.hidden = true;
    this.elements.errorText.textContent = "";
  }

  openDialog(id) {
    const dialog = this.root.getElementById(id);
    if (!dialog) return null;
    dialog.returnValue = "";
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    return dialog;
  }

  closeDialog(id, returnValue = "") {
    const dialog = this.root.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close(returnValue);
    else dialog.removeAttribute("open");
  }

  waitForDialog(id) {
    const dialog = this.openDialog(id);
    if (!dialog) return Promise.resolve("cancel");
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue || "cancel"), { once: true });
    });
  }

  async confirm({ title, message, confirmLabel = "実行する", danger = true }) {
    this.root.getElementById("confirm-title").textContent = title;
    this.root.getElementById("confirm-message").textContent = message;
    const button = this.root.getElementById("confirm-action-button");
    button.textContent = confirmLabel;
    button.className = danger ? "danger-button" : "primary-button";
    return (await this.waitForDialog("confirm-dialog")) === "confirm";
  }
}

export { MODE_LABELS, NOTIFICATION_LABELS, TIMER_STATE_LABELS };
