import {
  ABSENCE_TIMEOUT_OPTIONS_SECONDS,
  APP_SCHEMA_VERSION,
  DEFAULT_POMODORO,
  EXAM_WARNING_THRESHOLDS_MS,
  NOTIFICATION_METHODS,
  NOTIFICATION_VOLUMES,
  RESUME_MODES,
  STORAGE_KEYS,
  TIMER_DISPLAY_MODES,
  TIMER_MODES,
} from "./constants.js";
import {
  safeGetJSON,
  safeRemoveItem,
  safeSetJSON,
} from "./storage.js";

export const SETTINGS_VERSION = APP_SCHEMA_VERSION;
export const MAX_QUICK_TIMERS = 3;

export const DEFAULT_SUBJECTS = Object.freeze([
  { id: "japanese", name: "国語" },
  { id: "math", name: "数学" },
  { id: "english", name: "英語" },
  { id: "science", name: "理科" },
  { id: "social-studies", name: "社会" },
  { id: "other", name: "その他" },
]);

export const DEFAULT_SETTINGS = deepFreeze({
  timer: {
    lastMode: TIMER_MODES.COUNTDOWN,
    lastDurationMinutes: 25,
    countUpEnabled: false,
    displayMode: TIMER_DISPLAY_MODES.REMAINING,
  },
  clock: {
    format: "24h",
  },
  camera: {
    enabled: false,
    privacyAcknowledged: false,
    calibrated: false,
    absenceDetectionEnabled: true,
    gestureEnabled: true,
    absenceTimeoutSeconds: 30,
    resumeMode: RESUME_MODES.CONFIRM,
    previewEnabled: false,
  },
  notifications: {
    endMethod: NOTIFICATION_METHODS.SOUND,
    volume: NOTIFICATION_VOLUMES.MEDIUM,
    gestureSoundEnabled: true,
  },
  appearance: {
    theme: "system",
    fontSize: "medium",
  },
  wakeLock: {
    enabled: true,
  },
  history: {
    enabled: true,
  },
  pomodoro: { ...DEFAULT_POMODORO },
  exam: {
    durationMinutes: 60,
    displayMode: TIMER_DISPLAY_MODES.REMAINING,
    warningThresholdsMs: [...EXAM_WARNING_THRESHOLDS_MS],
    visualOnly: true,
    pauseDisabled: false,
    cameraAutoPauseEnabled: false,
    lockEnabled: true,
  },
  debug: {
    enabled: false,
  },
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

// Merge only keys present in the defaults. This prevents stale or malformed
// persisted values from silently becoming application configuration.
function mergeKnown(defaults, candidate) {
  if (!isPlainObject(defaults)) return candidate ?? defaults;
  const result = {};
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const candidateValue = isPlainObject(candidate) ? candidate[key] : undefined;
    if (isPlainObject(defaultValue)) {
      result[key] = mergeKnown(defaultValue, candidateValue);
    } else if (Array.isArray(defaultValue)) {
      result[key] = Array.isArray(candidateValue)
        ? clone(candidateValue)
        : clone(defaultValue);
    } else {
      // `null` is meaningful for options such as "do not auto-pause".
      result[key] = candidateValue === undefined ? defaultValue : candidateValue;
    }
  }
  return result;
}

function envelope(value) {
  return { version: SETTINGS_VERSION, value };
}

function unwrap(raw, fallback) {
  if (!raw) return clone(fallback);
  if (typeof raw.version === "number" && "value" in raw) {
    // Add explicit migration branches here when SETTINGS_VERSION increments.
    return raw.version <= SETTINGS_VERSION ? raw.value : clone(fallback);
  }
  // Version-zero values were stored without an envelope.
  return raw;
}

export function loadSettings() {
  const raw = safeGetJSON(STORAGE_KEYS.settings, null);
  return mergeKnown(DEFAULT_SETTINGS, unwrap(raw, DEFAULT_SETTINGS));
}

/** Deep-merge a partial update into the current validated settings. */
export function saveSettings(update) {
  const current = loadSettings();
  const mergedInput = mergePartial(current, update);
  const next = mergeKnown(DEFAULT_SETTINGS, mergedInput);
  safeSetJSON(STORAGE_KEYS.settings, envelope(next));
  return clone(next);
}

export function resetSettings() {
  safeRemoveItem(STORAGE_KEYS.settings);
  const defaults = clone(DEFAULT_SETTINGS);
  safeSetJSON(STORAGE_KEYS.settings, envelope(defaults));
  return defaults;
}

function mergePartial(base, patch) {
  if (!isPlainObject(patch)) return clone(base);
  const result = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in result)) continue;
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? mergePartial(result[key], value)
      : clone(value);
  }
  return result;
}

function normalizeSubject(subject, index = 0) {
  const name = String(subject?.name ?? "").trim();
  if (!name) return null;
  return {
    id: String(subject?.id || createId(`subject-${index}`)),
    name: name.slice(0, 40),
  };
}

export function loadSubjects() {
  const raw = unwrap(safeGetJSON(STORAGE_KEYS.subjects, null), DEFAULT_SUBJECTS);
  const values = Array.isArray(raw) ? raw : DEFAULT_SUBJECTS;
  const normalized = values.map(normalizeSubject).filter(Boolean);
  return normalized.length ? normalized : clone(DEFAULT_SUBJECTS);
}

export function saveSubjects(subjects) {
  if (!Array.isArray(subjects)) throw new TypeError("subjects must be an array");
  const seen = new Set();
  const normalized = subjects
    .map(normalizeSubject)
    .filter((subject) => subject && !seen.has(subject.id) && seen.add(subject.id));
  safeSetJSON(STORAGE_KEYS.subjects, envelope(normalized));
  return clone(normalized);
}

export function addSubject(name) {
  const subjects = loadSubjects();
  const normalizedName = String(name ?? "").trim();
  if (!normalizedName) throw new TypeError("Subject name is required");
  const subject = normalizeSubject({ id: createId("subject"), name: normalizedName });
  subjects.push(subject);
  saveSubjects(subjects);
  return clone(subject);
}

export function updateSubject(id, update) {
  const subjects = loadSubjects();
  const index = subjects.findIndex((subject) => subject.id === id);
  if (index < 0) return null;
  const next = normalizeSubject({ ...subjects[index], ...update });
  if (!next) throw new TypeError("Subject name is required");
  subjects[index] = next;
  saveSubjects(subjects);
  return clone(next);
}

export function removeSubject(id) {
  const subjects = loadSubjects();
  const next = subjects.filter((subject) => subject.id !== id);
  if (next.length === subjects.length) return false;
  saveSubjects(next);
  return true;
}

function normalizeQuickTimer(value, index = 0) {
  const name = String(value?.name ?? "").trim();
  const durationMinutes = Math.round(Number(value?.durationMinutes));
  if (!name || !Number.isFinite(durationMinutes) || durationMinutes < 1) return null;
  const timeout = value.absenceTimeoutSeconds;
  return {
    id: String(value.id || createId(`quick-${index}`)),
    name: name.slice(0, 40),
    durationMinutes: Math.min(durationMinutes, 24 * 60),
    subjectId: value.subjectId ? String(value.subjectId) : null,
    notificationMethod: Object.values(NOTIFICATION_METHODS).includes(value.notificationMethod)
      ? value.notificationMethod
      : NOTIFICATION_METHODS.SOUND,
    cameraEnabled: Boolean(value.cameraEnabled),
    absenceTimeoutSeconds: ABSENCE_TIMEOUT_OPTIONS_SECONDS.includes(timeout)
      ? timeout
      : 30,
    updatedAt: Number(value.updatedAt) || Date.now(),
  };
}

export function loadQuickTimers() {
  const raw = unwrap(safeGetJSON(STORAGE_KEYS.quickTimers, null), []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeQuickTimer).filter(Boolean).slice(0, MAX_QUICK_TIMERS);
}

export function saveQuickTimers(quickTimers) {
  if (!Array.isArray(quickTimers)) {
    throw new TypeError("quickTimers must be an array");
  }
  const normalized = quickTimers
    .map(normalizeQuickTimer)
    .filter(Boolean)
    .slice(0, MAX_QUICK_TIMERS);
  safeSetJSON(STORAGE_KEYS.quickTimers, envelope(normalized));
  return clone(normalized);
}

export function upsertQuickTimer(value) {
  const timers = loadQuickTimers();
  const normalized = normalizeQuickTimer({ ...value, updatedAt: Date.now() });
  if (!normalized) throw new TypeError("Quick timer name and duration are required");
  const index = timers.findIndex((timer) => timer.id === normalized.id);
  if (index >= 0) timers[index] = normalized;
  else {
    if (timers.length >= MAX_QUICK_TIMERS) {
      throw new RangeError(`Only ${MAX_QUICK_TIMERS} quick timers can be saved`);
    }
    timers.push(normalized);
  }
  saveQuickTimers(timers);
  return clone(normalized);
}

export function removeQuickTimer(id) {
  const timers = loadQuickTimers();
  const next = timers.filter((timer) => timer.id !== id);
  if (next.length === timers.length) return false;
  saveQuickTimers(next);
  return true;
}

/** Reset settings, subjects and quick timers; study history is intentionally kept. */
export function resetPreferences() {
  safeRemoveItem(STORAGE_KEYS.subjects);
  safeRemoveItem(STORAGE_KEYS.quickTimers);
  return {
    settings: resetSettings(),
    subjects: saveSubjects(clone(DEFAULT_SUBJECTS)),
    quickTimers: saveQuickTimers([]),
  };
}

export function loadPreferences() {
  return {
    version: SETTINGS_VERSION,
    settings: loadSettings(),
    subjects: loadSubjects(),
    quickTimers: loadQuickTimers(),
  };
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
