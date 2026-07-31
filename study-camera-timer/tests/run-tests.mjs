import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDirectory, "..");
const MINUTE_MS = 60_000;

const storageValues = new Map();
globalThis.localStorage = {
  getItem: (key) => storageValues.has(key) ? storageValues.get(key) : null,
  setItem: (key, value) => storageValues.set(key, String(value)),
  removeItem: (key) => storageValues.delete(key),
  clear: () => storageValues.clear()
};

const {
  TIMER_MODES,
  TIMER_STATES
} = await import("../js/constants.js");
const { StudyTimer } = await import("../js/timer.js");
const { FacePresenceTracker } = await import("../js/faceDetector.js");
const { PalmGestureController } = await import("../js/gestureController.js");
const { AttendanceController } = await import("../js/attendanceController.js");
const { CameraController, CAMERA_STATES } = await import("../js/camera.js");
const { ALARM_SOUNDS, Notifier } = await import("../js/notifier.js");
const {
  loadSettings,
  saveSettings,
  saveQuickTimers,
  loadQuickTimers,
  resetPreferences
} = await import("../js/settings.js");
const {
  createSessionRecord,
  buildHistorySummary
} = await import("../js/history.js");

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("countdown uses wall-clock deltas and excludes manual pauses", () => {
  const timer = new StudyTimer({ durationMinutes: 1, autoTick: false, now: () => 1_000 });
  timer.start(1_000);
  timer.tick(16_000);
  assert.equal(timer.getSnapshot(16_000).remainingMs, 45_000);
  timer.pause(16_000);
  timer.tick(26_000);
  assert.equal(timer.getSnapshot(26_000).stats.manualPauseMs, 10_000);
  timer.start(26_000);
  timer.tick(71_000);
  const result = timer.getSnapshot(71_000);
  assert.equal(result.state, TIMER_STATES.COMPLETED);
  assert.equal(result.stats.actualStudyMs, 60_000);
});

test("brief face loss cancels without pausing", () => {
  const timer = new StudyTimer({ durationMinutes: 2, autoTick: false, now: () => 1_000 });
  timer.start(1_000);
  timer.reportFaceMissing(3_000);
  timer.tick(8_000);
  timer.reportFacePresent(8_000);
  const result = timer.getSnapshot(8_000);
  assert.equal(result.state, TIMER_STATES.RUNNING);
  assert.equal(result.stats.absenceCount, 0);
  assert.equal(result.stats.actualStudyMs, 7_000);
});

test("confirmed absence rolls progress back to the first stable missing sample", () => {
  const timer = new StudyTimer({
    durationMinutes: 2,
    autoTick: false,
    now: () => 1_000,
    absenceTimeoutSeconds: 30
  });
  timer.start(1_000);
  timer.tick(6_000);
  timer.reportFaceMissing(6_000);
  timer.tick(36_000);
  let result = timer.getSnapshot(36_000);
  assert.equal(result.state, TIMER_STATES.ABSENCE_PAUSED);
  assert.equal(result.stats.actualStudyMs, 5_000);
  assert.equal(result.stats.absenceMs, 30_000);
  timer.reportFacePresent(41_000);
  timer.resumeFromAbsence(42_000);
  timer.tick(47_000);
  result = timer.getSnapshot(47_000);
  assert.equal(result.state, TIMER_STATES.RUNNING);
  assert.equal(result.stats.actualStudyMs, 10_000);
  assert.equal(result.stats.absenceMs, 35_000);
  assert.equal(result.absenceEvents[0].faceRedetectedAt, 41_000);
  assert.equal(result.absenceEvents[0].userResumedAt, 42_000);
});

test("background interruption is excluded and confirmation wait is ignored", () => {
  const timer = new StudyTimer({ durationMinutes: 2, autoTick: false, now: () => 1_000 });
  timer.start(1_000);
  timer.tick(11_000);
  timer.enterBackground(11_000);
  timer.leaveBackground(31_000);
  timer.resolveBackground(false, 32_000);
  timer.tick(42_000);
  const result = timer.getSnapshot(42_000);
  assert.equal(result.stats.actualStudyMs, 20_000);
  assert.equal(result.stats.backgroundExcludedMs, 20_000);
});

test("count-up remains running after zero and reports overtime", () => {
  const timer = new StudyTimer({
    durationMinutes: 1,
    countUpEnabled: true,
    autoTick: false,
    now: () => 1_000
  });
  timer.start(1_000);
  timer.tick(91_000);
  const result = timer.getSnapshot(91_000);
  assert.equal(result.state, TIMER_STATES.RUNNING);
  assert.equal(result.remainingMs, 0);
  assert.equal(result.overtimeMs, 30_000);
  assert.equal(result.stats.actualStudyMs, 90_000);
});

test("count-up defers completion while an absence candidate can roll time back", () => {
  const timer = new StudyTimer({
    durationMinutes: 1,
    countUpEnabled: true,
    absenceTimeoutSeconds: 30,
    autoTick: false,
    now: () => 1_000
  });
  let targets = 0;
  timer.addEventListener("targetreached", () => { targets += 1; });
  timer.start(1_000);
  timer.tick(56_000);
  timer.reportFaceMissing(56_000);
  timer.tick(91_000);
  let result = timer.getSnapshot(91_000);
  assert.equal(result.state, TIMER_STATES.ABSENCE_PAUSED);
  assert.equal(result.elapsedMs, 55_000);
  assert.equal(result.stats.absenceMs, 35_000);
  assert.equal(targets, 0);
  timer.reportFacePresent(92_000);
  timer.resumeFromAbsence(92_000);
  timer.tick(97_000);
  result = timer.getSnapshot(97_000);
  assert.equal(result.elapsedMs, 60_000);
  assert.equal(targets, 1);
});

test("countdown defers completion until an absence candidate is resolved", () => {
  const timer = new StudyTimer({
    durationMinutes: 1,
    absenceTimeoutSeconds: 30,
    autoTick: false,
    now: () => 1_000
  });
  timer.start(1_000);
  timer.tick(56_000);
  timer.reportFaceMissing(56_000);
  timer.tick(61_000);
  assert.equal(timer.getSnapshot(61_000).state, TIMER_STATES.RUNNING);
  timer.tick(86_000);
  let result = timer.getSnapshot(86_000);
  assert.equal(result.state, TIMER_STATES.ABSENCE_PAUSED);
  assert.equal(result.elapsedMs, 55_000);
  assert.equal(result.completed, false);
  timer.reportFacePresent(87_000);
  timer.resumeFromAbsence(87_000);
  timer.tick(92_000);
  result = timer.getSnapshot(92_000);
  assert.equal(result.state, TIMER_STATES.COMPLETED);
  assert.equal(result.stats.actualStudyMs, 60_000);
});

test("countdown caps study time when a late absence candidate is cancelled", () => {
  const timer = new StudyTimer({
    durationMinutes: 1,
    absenceTimeoutSeconds: 30,
    autoTick: false,
    now: () => 1_000
  });
  timer.start(1_000);
  timer.tick(56_000);
  timer.reportFaceMissing(56_000);
  timer.tick(66_000);
  timer.reportFacePresent(66_000);
  const result = timer.getSnapshot(66_000);
  assert.equal(result.state, TIMER_STATES.COMPLETED);
  assert.equal(result.stats.actualStudyMs, 60_000);
});

test("Pomodoro advances from study to break and can skip the remainder", () => {
  const timer = new StudyTimer({
    mode: TIMER_MODES.POMODORO,
    autoTick: false,
    now: () => 1_000,
    pomodoro: {
      studyMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 2,
      longBreakEvery: 4,
      autoStartBreak: true,
      autoStartStudy: false
    }
  });
  timer.start(1_000);
  timer.tick(61_000);
  assert.equal(timer.getSnapshot(61_000).state, TIMER_STATES.BREAK);
  assert.equal(timer.getSnapshot(61_000).phase.kind, "short_break");
  assert.equal(timer.skipBreak(66_000), true);
  const result = timer.getSnapshot(66_000);
  assert.equal(result.state, TIMER_STATES.PAUSED);
  assert.equal(result.phase.kind, "study");
  assert.equal(result.stats.breakMs, 5_000);
});

test("Pomodoro does not skip a later break after a delayed tick", () => {
  const timer = new StudyTimer({
    mode: TIMER_MODES.POMODORO,
    autoTick: false,
    now: () => 1_000,
    pomodoro: {
      studyMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 2,
      longBreakEvery: 4,
      autoStartBreak: true,
      autoStartStudy: true
    }
  });
  timer.start(1_000);
  timer.tick(61_000);
  assert.equal(timer.getSnapshot(61_000).phase.kind, "short_break");
  assert.equal(timer.skipBreak(181_001), false);
  const result = timer.getSnapshot(181_001);
  assert.equal(result.phase.kind, "short_break");
  assert.equal(result.stats.completedStudySets, 2);
  assert.equal(result.phase.elapsedMs, 1);
});

test("Pomodoro defers the study-to-break transition for an absence candidate", () => {
  const timer = new StudyTimer({
    mode: TIMER_MODES.POMODORO,
    absenceTimeoutSeconds: 30,
    autoTick: false,
    now: () => 1_000,
    pomodoro: {
      studyMinutes: 1,
      shortBreakMinutes: 1,
      autoStartBreak: true
    }
  });
  timer.start(1_000);
  timer.tick(56_000);
  timer.reportFaceMissing(56_000);
  timer.tick(61_000);
  assert.equal(timer.getSnapshot(61_000).phase.kind, "study");
  timer.tick(86_000);
  assert.equal(timer.getSnapshot(86_000).state, TIMER_STATES.ABSENCE_PAUSED);
  timer.reportFacePresent(87_000);
  timer.resumeFromAbsence(87_000);
  timer.tick(92_000);
  const result = timer.getSnapshot(92_000);
  assert.equal(result.state, TIMER_STATES.BREAK);
  assert.equal(result.phase.kind, "short_break");
  assert.equal(result.stats.completedStudySets, 1);
});

test("exam lock blocks reset until forced", () => {
  const timer = new StudyTimer({
    mode: TIMER_MODES.EXAM,
    durationMinutes: 60,
    autoTick: false,
    now: () => 1_000,
    exam: { lockEnabled: true, pauseDisabled: true }
  });
  timer.start(1_000);
  assert.equal(timer.pause(2_000), false);
  assert.equal(timer.reset(2_000), false);
  assert.equal(timer.reset(2_000, { force: true }), true);
});

test("face tracker requires 7 misses and 6 hits with hysteresis", () => {
  const tracker = new FacePresenceTracker({ warmupMs: 0 });
  tracker.reset(0);
  for (let index = 0; index < 7; index += 1) tracker.updateDetected(false, { now: index + 1 });
  assert.equal(tracker.getSnapshot(8).state, "absent");
  for (let index = 0; index < 6; index += 1) tracker.updateDetected(true, { now: index + 10 });
  assert.equal(tracker.getSnapshot(20).state, "present");
});

test("palm gesture holds for 0.8s, latches, and respects cooldown", () => {
  const gesture = new PalmGestureController({ holdMs: 800, cooldownMs: 2_000 });
  assert.equal(gesture.process(true, 1_000).triggered, false);
  assert.equal(gesture.process(true, 1_799).triggered, false);
  assert.equal(gesture.process(true, 1_800).triggered, true);
  assert.equal(gesture.process(true, 4_000).triggered, false);
  gesture.process(false, 4_100);
  assert.equal(gesture.process(true, 4_200).triggered, false);
  assert.equal(gesture.process(true, 5_000).triggered, true);
});

test("attendance emits pending, pause, and return in order", () => {
  const attendance = new AttendanceController({ warmupMs: 0, pendingAfterMs: 10_000, pauseAfterMs: 30_000 });
  const events = [];
  ["candidate", "pending", "pause", "return"].forEach((name) => {
    attendance.addEventListener(name, () => events.push(name));
  });
  attendance.setMonitoring(true, { now: 1_000 });
  attendance.update({ state: "absent" }, { now: 1_000, monitoring: true });
  attendance.update({ state: "absent" }, { now: 11_000, monitoring: true });
  attendance.update({ state: "absent" }, { now: 31_000, monitoring: true });
  attendance.update({ state: "present" }, { now: 41_000, monitoring: false });
  assert.deepEqual(events, ["candidate", "pending", "pause", "return"]);
});

test("attendance ignores missing faces during the timer startup warmup", () => {
  const attendance = new AttendanceController({ warmupMs: 3_000 });
  let candidates = 0;
  attendance.addEventListener("candidate", () => { candidates += 1; });
  attendance.setMonitoring(true, { now: 1_000 });
  attendance.update({ state: "absent" }, { now: 1_000, monitoring: true });
  attendance.update({ state: "absent" }, { now: 3_999, monitoring: true });
  assert.equal(candidates, 0);
  attendance.update({ state: "absent" }, { now: 4_000, monitoring: true });
  assert.equal(candidates, 1);
});

test("audio unlock timeout cannot block the timer interaction path", async () => {
  const audioContext = {
    state: "suspended",
    resume: () => new Promise(() => undefined)
  };
  const notifier = new Notifier({
    audioContext,
    autoUnlock: false,
    unlockTimeoutMs: 50
  });
  const startedAt = Date.now();
  assert.equal(await notifier.unlock(), false);
  assert.ok(Date.now() - startedAt < 500);
});

test("alarm repeats until explicitly stopped and releases scheduled audio", async () => {
  let oscillatorCount = 0;
  let stopCount = 0;
  let disconnectCount = 0;
  const audioContext = {
    state: "running",
    currentTime: 0,
    destination: {},
    createOscillator() {
      oscillatorCount += 1;
      return {
        type: "sine",
        frequency: { setValueAtTime: () => undefined },
        connect: () => undefined,
        disconnect: () => { disconnectCount += 1; },
        addEventListener: () => undefined,
        start: () => undefined,
        stop: () => { stopCount += 1; }
      };
    },
    createGain() {
      return {
        gain: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined
        },
        connect: () => undefined,
        disconnect: () => { disconnectCount += 1; }
      };
    }
  };
  const notifier = new Notifier({
    audioContext,
    autoUnlock: false,
    repeatIntervalMs: 50
  });
  const first = await notifier.startAlarm("complete", { mode: "sound", sound: "digital" });
  assert.equal(first.repeating, true);
  assert.equal(notifier.isAlarmActive, true);
  await new Promise((resolve) => setTimeout(resolve, 125));
  assert.ok(oscillatorCount >= 8, `expected repeated notes, got ${oscillatorCount}`);
  assert.equal(notifier.suspendAlarm(), true);
  const countAtSuspend = oscillatorCount;
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(oscillatorCount, countAtSuspend);
  assert.equal(notifier.refreshAlarm(), true);
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.ok(oscillatorCount > countAtSuspend);
  const countAtStop = oscillatorCount;
  const stopsBeforeStop = stopCount;
  assert.equal(notifier.stopAlarm({ reason: "test" }), true);
  assert.equal(notifier.isAlarmActive, false);
  assert.ok(stopCount > stopsBeforeStop, "explicit stop should stop already scheduled oscillators");
  assert.ok(disconnectCount >= countAtStop * 2, "source and gain nodes should be disconnected");
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(oscillatorCount, countAtStop);
});

test("five alarm sounds are distinct and invalid sound IDs fall back safely", async () => {
  assert.equal(Object.keys(ALARM_SOUNDS).length, 5);
  const signatures = Object.values(ALARM_SOUNDS).map(({ cue }) => JSON.stringify({
    waveform: cue.waveform,
    notes: cue.notes
  }));
  assert.equal(new Set(signatures).size, 5);
  const notifier = new Notifier({ autoUnlock: false });
  assert.equal(notifier.setSound("digital"), "digital");
  assert.equal(notifier.setSound("not-a-sound"), "clear_chime");
});

test("unsupported vibration falls back to a visible flash", async () => {
  const notifier = new Notifier({ navigator: {}, autoUnlock: false });
  let flashes = 0;
  notifier.flash = async () => {
    flashes += 1;
    return true;
  };
  const result = await notifier.notify("complete", { mode: "vibrate" });
  assert.equal(notifier.vibrationSupported, false);
  assert.equal(result.vibrated, false);
  assert.equal(result.flashed, true);
  assert.equal(flashes, 1);
});

test("notification sound and repeat preference persist with safe defaults", () => {
  storageValues.clear();
  resetPreferences();
  let current = loadSettings();
  assert.equal(current.notifications.sound, "clear_chime");
  assert.equal(current.notifications.repeatUntilStopped, true);
  saveSettings({ notifications: { sound: "school", repeatUntilStopped: false } });
  current = loadSettings();
  assert.equal(current.notifications.sound, "school");
  assert.equal(current.notifications.repeatUntilStopped, false);
  saveSettings({ notifications: { sound: "invalid" } });
  assert.equal(loadSettings().notifications.sound, "clear_chime");
});

test("camera controller can start and releases its media track", async () => {
  const names = ["navigator", "document", "isSecureContext", "requestAnimationFrame", "cancelAnimationFrame"];
  const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const restore = () => names.forEach((name) => {
    const descriptor = descriptors.get(name);
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
  let trackStopped = false;
  const track = {
    readyState: "live",
    enabled: true,
    muted: false,
    label: "mock front camera",
    getSettings: () => ({ width: 640, height: 480, facingMode: "user" }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    stop() {
      this.readyState = "ended";
      trackStopped = true;
    }
  };
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track]
  };
  const video = {
    readyState: 2,
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 0,
    srcObject: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setAttribute: () => undefined,
    play: async () => undefined,
    pause: () => undefined
  };
  const moduleSource = `
    export const FilesetResolver = { forVisionTasks: async () => ({}) };
    export class FaceDetector {
      static async createFromOptions() {
        return { detectForVideo: () => ({ detections: [] }), close: () => undefined };
      }
    }
    export class HandLandmarker { static async createFromOptions() { return { close: () => undefined }; } }
  `;
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { mediaDevices: { getUserMedia: async () => stream } }
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        visibilityState: "visible",
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      }
    });
    Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      value: () => 1
    });
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      value: () => undefined
    });
    const moduleUrl = `data:text/javascript,${encodeURIComponent(moduleSource)}`;
    const camera = new CameraController({ moduleUrl, wasmUrl: "mock://wasm", handEnabled: false });
    const started = await camera.start({ videoElement: video, handEnabled: false });
    assert.equal(started.state, CAMERA_STATES.RUNNING);
    assert.equal(trackStopped, false);
    const stopped = await camera.stop();
    assert.equal(stopped.state, CAMERA_STATES.IDLE);
    assert.equal(trackStopped, true);
  } finally {
    restore();
  }
});

test("settings preserve the explicit no-auto-pause null value", () => {
  storageValues.clear();
  resetPreferences();
  saveSettings({ camera: { absenceTimeoutSeconds: null } });
  assert.equal(loadSettings().camera.absenceTimeoutSeconds, null);
});

test("quick timer storage is capped at three", () => {
  storageValues.clear();
  const saved = saveQuickTimers([1, 2, 3, 4].map((index) => ({
    name: `Timer ${index}`,
    durationMinutes: index * 5,
    absenceTimeoutSeconds: 30
  })));
  assert.equal(saved.length, 3);
  assert.equal(loadQuickTimers().length, 3);
});

test("history record and Monday-week aggregates use actual study time", () => {
  const monday = new Date(2026, 6, 27, 9, 0, 0).getTime();
  const snapshot = {
    sessionId: "session-a",
    sessionStartedAt: monday,
    sessionEndedAt: monday + 30 * MINUTE_MS,
    completed: true,
    mode: "countdown",
    durationMs: 25 * MINUTE_MS,
    stats: {
      actualStudyMs: 25 * MINUTE_MS,
      absenceMs: 5 * MINUTE_MS,
      breakMs: 0,
      manualPauseMs: 0,
      backgroundExcludedMs: 0,
      absenceCount: 1,
      pauseCount: 0,
      completedStudySets: 0
    },
    absenceEvents: []
  };
  const record = createSessionRecord(snapshot, { subjectId: "math", subjectName: "数学" });
  const summary = buildHistorySummary([record], monday + 60_000);
  assert.equal(summary.today.actualStudyMs, 25 * MINUTE_MS);
  assert.equal(summary.week.actualStudyMs, 25 * MINUTE_MS);
  assert.equal(summary.bySubject[0].subjectName, "数学");
  assert.equal(summary.completionRate, 1);
});

test("Pomodoro history records the configured study phase duration", () => {
  const timer = new StudyTimer({
    mode: TIMER_MODES.POMODORO,
    durationMinutes: 25,
    autoTick: false,
    now: () => 1_000,
    pomodoro: { studyMinutes: 40 }
  });
  timer.start(1_000);
  timer.tick(61_000);
  timer.finish(61_000, { force: true });
  const record = createSessionRecord(timer.getSnapshot(61_000));
  assert.equal(record.configuredDurationMs, 40 * MINUTE_MS);
});

test("HTML references exist and every app module is present", () => {
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const appSource = fs.readFileSync(path.join(appRoot, "js", "app.js"), "utf8");
  const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicateIds)], []);
  const ids = [...appSource.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((match) => match[1]);
  const missingIds = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missingIds, []);
  const soundSelect = html.match(/<select id="setting-sound">([\s\S]*?)<\/select>/)?.[1] || "";
  assert.equal((soundSelect.match(/<option\b/g) || []).length, 5);
  assert.ok(html.includes('id="alarm-dialog"'));
  assert.ok(html.includes('id="stop-alarm-button"'));
  const scripts = [
    "constants.js", "storage.js", "settings.js", "timer.js", "history.js",
    "faceDetector.js", "handDetector.js", "gestureController.js",
    "attendanceController.js", "camera.js", "notifier.js", "wakeLock.js",
    "debug.js", "ui.js", "app.js"
  ];
  scripts.forEach((file) => assert.equal(fs.existsSync(path.join(appRoot, "js", file)), true, file));
  assert.equal(fs.existsSync(path.join(appRoot, "icons", "icon-192.png")), true);
  assert.equal(fs.existsSync(path.join(appRoot, "icons", "icon-512.png")), true);
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
});

let passed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} tests passed`);
