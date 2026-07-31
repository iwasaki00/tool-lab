import {
  clearHistoryRecords,
  deleteHistoryRecord,
  getHistoryRecord,
  listHistoryRecords,
  saveHistoryRecord,
} from "./storage.js";

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function validTimestamp(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function localDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayStart(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function mondayStart(timestamp) {
  const date = new Date(dayStart(timestamp));
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

function summarize(records) {
  return records.reduce((summary, record) => {
    summary.sessionCount += 1;
    summary.actualStudyMs += nonNegative(record.actualStudyMs);
    summary.breakMs += nonNegative(record.breakMs);
    summary.absenceMs += nonNegative(record.absenceMs);
    summary.manualPauseMs += nonNegative(record.manualPauseMs);
    summary.backgroundExcludedMs += nonNegative(record.backgroundExcludedMs);
    summary.absenceCount += nonNegative(record.absenceCount);
    summary.pauseCount += nonNegative(record.pauseCount);
    if (record.completed) summary.completedCount += 1;
    return summary;
  }, {
    sessionCount: 0,
    completedCount: 0,
    actualStudyMs: 0,
    breakMs: 0,
    absenceMs: 0,
    manualPauseMs: 0,
    backgroundExcludedMs: 0,
    absenceCount: 0,
    pauseCount: 0,
  });
}

function configuredDurationMs(snapshot) {
  if (snapshot.mode === "stopwatch") return null;
  if (snapshot.mode === "pomodoro") {
    const studyMinutes = Number(snapshot.config?.pomodoro?.studyMinutes);
    return Number.isFinite(studyMinutes) ? Math.max(0, studyMinutes) * 60_000 : snapshot.durationMs ?? null;
  }
  return snapshot.config?.durationMs ?? snapshot.durationMs ?? null;
}

/**
 * Convert a StudyTimer snapshot into the stable persistence shape.
 * Metadata belongs to UI concerns (subject and memo), not the timer engine.
 */
export function createSessionRecord(snapshot, metadata = {}) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new TypeError("A StudyTimer snapshot is required");
  }
  const now = Date.now();
  const startedAt = validTimestamp(snapshot.sessionStartedAt, now);
  const endedAt = validTimestamp(snapshot.sessionEndedAt, now);
  const stats = snapshot.stats || {};
  const completed = metadata.completed ?? snapshot.completed ?? false;
  return {
    id: String(metadata.id || snapshot.sessionId || createId("history")),
    schemaVersion: 1,
    date: localDateKey(startedAt),
    startedAt,
    endedAt,
    configuredDurationMs: configuredDurationMs(snapshot),
    actualStudyMs: nonNegative(stats.actualStudyMs),
    breakMs: nonNegative(stats.breakMs),
    absenceMs: nonNegative(stats.absenceMs),
    manualPauseMs: nonNegative(stats.manualPauseMs),
    backgroundExcludedMs: nonNegative(stats.backgroundExcludedMs),
    absenceCount: nonNegative(stats.absenceCount),
    pauseCount: nonNegative(stats.pauseCount),
    completed: Boolean(completed),
    status: completed ? "completed" : "interrupted",
    mode: snapshot.mode || "countdown",
    subjectId: metadata.subjectId ? String(metadata.subjectId) : null,
    subjectName: metadata.subjectName ? String(metadata.subjectName).trim().slice(0, 40) : null,
    memo: metadata.memo ? String(metadata.memo).trim().slice(0, 1_000) : "",
    completedStudySets: nonNegative(stats.completedStudySets),
    absenceEvents: Array.isArray(snapshot.absenceEvents)
      ? snapshot.absenceEvents.map((event) => ({ ...event }))
      : [],
    createdAt: validTimestamp(metadata.createdAt, now),
    updatedAt: now,
  };
}

/** Build and persist a session in one operation. */
export async function saveSession(snapshot, metadata = {}) {
  const record = createSessionRecord(snapshot, metadata);
  return saveHistoryRecord(record);
}

export async function listSessions() {
  return listHistoryRecords();
}

export async function getSession(id) {
  return getHistoryRecord(id);
}

export async function deleteSession(id) {
  return deleteHistoryRecord(id);
}

export async function clearSessions() {
  return clearHistoryRecords();
}

/** Aggregate sessions assigned to the device-local calendar day. */
export function getTodaySummary(records, now = Date.now()) {
  const today = localDateKey(now);
  return {
    date: today,
    ...summarize(records.filter((record) => (record.date || localDateKey(record.startedAt)) === today)),
  };
}

/** Aggregate the Monday-through-Sunday week containing now. */
export function getWeekSummary(records, now = Date.now()) {
  const start = mondayStart(now);
  const end = start + 7 * 24 * 60 * 60 * 1_000;
  return {
    startedAt: start,
    endedAt: end,
    ...summarize(records.filter((record) => {
      const timestamp = Number(record.startedAt);
      return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
    })),
  };
}

/** Return subject totals sorted by actual study time, highest first. */
export function aggregateBySubject(records) {
  const groups = new Map();
  for (const record of records) {
    const id = record.subjectId || "unassigned";
    const group = groups.get(id) || {
      subjectId: id,
      subjectName: record.subjectName || null,
      records: [],
    };
    group.records.push(record);
    if (!group.subjectName && record.subjectName) group.subjectName = record.subjectName;
    groups.set(id, group);
  }
  return [...groups.values()]
    .map((group) => ({
      subjectId: group.subjectId,
      subjectName: group.subjectName
        || (group.subjectId === "unassigned" ? "未設定" : group.subjectId),
      ...summarize(group.records),
    }))
    .sort((a, b) => b.actualStudyMs - a.actualStudyMs);
}

/** Group and summarize by local date, newest date first. */
export function aggregateByDay(records) {
  const groups = new Map();
  for (const record of records) {
    const key = record.date || localDateKey(record.startedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()]
    .map(([date, dayRecords]) => ({ date, ...summarize(dayRecords) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Completion percentage; an empty history deliberately reports zero. */
export function calculateCompletionRate(records) {
  if (!records.length) return 0;
  const completed = records.filter((record) => record.completed).length;
  return completed / records.length;
}

export function buildHistorySummary(records, now = Date.now()) {
  const values = Array.isArray(records) ? records : [];
  return {
    today: getTodaySummary(values, now),
    week: getWeekSummary(values, now),
    bySubject: aggregateBySubject(values),
    byDay: aggregateByDay(values),
    completionRate: calculateCompletionRate(values),
    all: summarize(values),
  };
}

export { localDateKey };
