/**
 * Application-wide constants.
 *
 * Timing values live here so camera/timer behaviour can be tuned after testing
 * on real iPhones without hunting through implementation modules.
 */

export const APP_SCHEMA_VERSION = 2;

export const TIMER_STATES = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  ABSENCE_PENDING: "absence_pending",
  ABSENCE_PAUSED: "absence_paused",
  BREAK: "break",
  COMPLETED: "completed",
  CAMERA_ERROR: "camera_error",
});

export const TIMER_MODES = Object.freeze({
  COUNTDOWN: "countdown",
  STOPWATCH: "stopwatch",
  POMODORO: "pomodoro",
  EXAM: "exam",
});

export const POMODORO_PHASES = Object.freeze({
  STUDY: "study",
  SHORT_BREAK: "short_break",
  LONG_BREAK: "long_break",
});

export const RESUME_MODES = Object.freeze({
  CONFIRM: "confirm",
  AUTO: "auto",
});

export const TIMER_DISPLAY_MODES = Object.freeze({
  REMAINING: "remaining",
  ELAPSED: "elapsed",
});

export const TIMER_PRESETS_MINUTES = Object.freeze([
  5, 10, 15, 25, 30, 45, 50, 60, 90,
]);

export const EXAM_PRESETS_MINUTES = Object.freeze([60, 80, 90, 120]);

export const DEFAULT_POMODORO = Object.freeze({
  studyMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreak: false,
  autoStartStudy: false,
});

export const ABSENCE_TIMEOUT_OPTIONS_SECONDS = Object.freeze([
  10,
  20,
  30,
  45,
  60,
  90,
  null,
]);

export const FACE_DETECTION = Object.freeze({
  resultHistorySize: 10,
  missingVotesRequired: 7,
  presentVotesRequired: 6,
  warmupMs: 3_000,
  pendingAfterMs: 10_000,
  defaultPauseAfterMs: 30_000,
  minimumConfidence: 0.5,
  darkLuminanceThreshold: 45,
  coveredLuminanceThreshold: 12,
});

export const GESTURE_DETECTION = Object.freeze({
  holdMs: 800,
  cooldownMs: 2_000,
  requiredExtendedFingers: 5,
  minimumHandConfidence: 0.65,
  minimumPresenceConfidence: 0.6,
  minimumTrackingConfidence: 0.6,
});

export const ANALYSIS = Object.freeze({
  preferredWidth: 640,
  preferredHeight: 480,
  faceIntervalRunningMs: 250,
  faceIntervalStoppedMs: 1_000,
  handIntervalMs: 300,
  minimumIntervalMs: 200,
  maximumIntervalMs: 2_000,
  slowAnalysisMs: 180,
  intervalBackoffFactor: 1.35,
  intervalRecoveryFactor: 0.95,
  recoverySampleCount: 10,
});

export const NOTIFICATION_METHODS = Object.freeze({
  SOUND: "sound",
  VIBRATION: "vibration",
  FLASH: "flash",
  SOUND_AND_FLASH: "sound_flash",
  SILENT: "silent",
});

export const NOTIFICATION_VOLUMES = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

export const NOTIFICATION_SOUNDS = Object.freeze({
  CLEAR_CHIME: "clear_chime",
  BELL: "bell",
  DIGITAL: "digital",
  SCHOOL: "school",
  GENTLE: "gentle",
});

export const NOTIFICATION_VOLUME_GAIN = Object.freeze({
  [NOTIFICATION_VOLUMES.LOW]: 0.25,
  [NOTIFICATION_VOLUMES.MEDIUM]: 0.55,
  [NOTIFICATION_VOLUMES.HIGH]: 0.9,
});

export const EXAM_WARNING_THRESHOLDS_MS = Object.freeze([
  10 * 60_000,
  5 * 60_000,
  60_000,
]);

export const TIMER_TICK_INTERVAL_MS = 250;

export const STORAGE_KEYS = Object.freeze({
  settings: "study-camera-timer:settings",
  subjects: "study-camera-timer:subjects",
  quickTimers: "study-camera-timer:quick-timers",
  history: "study-camera-timer:history",
});

export const STORAGE_ERROR_EVENT = "study-camera-timer:storage-error";

export const TIMER_EVENTS = Object.freeze({
  TICK: "tick",
  STATE_CHANGE: "statechange",
  PHASE_CHANGE: "phasechange",
  TARGET_REACHED: "targetreached",
  COMPLETED: "completed",
  THRESHOLD: "threshold",
  ABSENCE_CHANGE: "absencechange",
  BACKGROUND_CHANGE: "backgroundchange",
  BACKGROUND_QUESTION: "backgroundquestion",
  LOCKED_ACTION: "lockedaction",
  CONFIG_CHANGE: "configchange",
  RESET: "reset",
});
