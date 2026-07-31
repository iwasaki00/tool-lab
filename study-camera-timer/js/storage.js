import {
  APP_SCHEMA_VERSION,
  STORAGE_ERROR_EVENT,
  STORAGE_KEYS,
} from "./constants.js";

// A volatile fallback keeps the current session usable when Safari private
// browsing, quota limits, or storage policies reject a persistence operation.
const memoryFallback = new Map();
const errorHandlers = new Set();

function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function asError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

function emitStorageError(operation, key, error) {
  const detail = Object.freeze({
    operation,
    key,
    error: asError(error),
    occurredAt: Date.now(),
  });

  for (const handler of errorHandlers) {
    try {
      handler(detail);
    } catch (handlerError) {
      console.error("Storage error handler failed", handlerError);
    }
  }

  try {
    if (typeof globalThis.dispatchEvent === "function") {
      const event = typeof CustomEvent === "function"
        ? new CustomEvent(STORAGE_ERROR_EVENT, { detail })
        : Object.assign(new Event(STORAGE_ERROR_EVENT), { detail });
      globalThis.dispatchEvent(event);
    }
  } catch (dispatchError) {
    console.error("Could not dispatch storage error", dispatchError);
  }

  console.error(`[storage:${operation}] ${key}`, detail.error);
  return detail;
}

function browserStorage() {
  if (typeof globalThis.localStorage === "undefined") {
    throw new Error("localStorage is not available");
  }
  return globalThis.localStorage;
}

/** Register an error callback. Returns an unsubscribe function. */
export function onStorageError(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Storage error handler must be a function");
  }
  errorHandlers.add(handler);
  return () => errorHandlers.delete(handler);
}

/** Replace all existing callbacks with one optional callback. */
export function setStorageErrorHandler(handler) {
  errorHandlers.clear();
  return typeof handler === "function" ? onStorageError(handler) : () => {};
}

export function safeGetItem(key, fallback = null) {
  try {
    const value = browserStorage().getItem(key);
    if (value !== null) {
      memoryFallback.set(key, value);
      return value;
    }
    return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
  } catch (error) {
    emitStorageError("get", key, error);
    return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
  }
}

export function safeSetItem(key, value) {
  const serialized = String(value);
  memoryFallback.set(key, serialized);
  try {
    browserStorage().setItem(key, serialized);
    return true;
  } catch (error) {
    emitStorageError("set", key, error);
    return false;
  }
}

export function safeRemoveItem(key) {
  memoryFallback.delete(key);
  try {
    browserStorage().removeItem(key);
    return true;
  } catch (error) {
    emitStorageError("remove", key, error);
    return false;
  }
}

export function safeGetJSON(key, fallback = null) {
  const raw = safeGetItem(key, null);
  if (raw === null) return clone(fallback);
  try {
    return JSON.parse(raw);
  } catch (error) {
    emitStorageError("parse", key, error);
    return clone(fallback);
  }
}

export function safeSetJSON(key, value) {
  try {
    return safeSetItem(key, JSON.stringify(value));
  } catch (error) {
    emitStorageError("serialize", key, error);
    return false;
  }
}

export function isPersistentStorageAvailable() {
  const key = `${STORAGE_KEYS.settings}:probe`;
  try {
    const storage = browserStorage();
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch (error) {
    emitStorageError("probe", key, error);
    return false;
  }
}

function readHistoryEnvelope() {
  const value = safeGetJSON(STORAGE_KEYS.history, null);
  if (Array.isArray(value)) {
    // Version-zero data was stored as a bare array.
    return { version: APP_SCHEMA_VERSION, records: value };
  }
  if (!value || !Array.isArray(value.records)) {
    return { version: APP_SCHEMA_VERSION, records: [] };
  }
  return {
    version: APP_SCHEMA_VERSION,
    records: value.records,
  };
}

function writeHistory(records) {
  return safeSetJSON(STORAGE_KEYS.history, {
    version: APP_SCHEMA_VERSION,
    records,
  });
}

/** List session records, newest first. */
export async function listHistoryRecords() {
  return clone(readHistoryEnvelope().records).sort(
    (a, b) => Number(b.endedAt ?? b.startedAt ?? 0)
      - Number(a.endedAt ?? a.startedAt ?? 0),
  );
}

export async function getHistoryRecord(id) {
  const record = readHistoryEnvelope().records.find((item) => item.id === id);
  return record ? clone(record) : null;
}

/** Insert or replace a record by id. */
export async function saveHistoryRecord(record) {
  if (!record || typeof record !== "object" || !record.id) {
    throw new TypeError("A history record with an id is required");
  }
  const records = readHistoryEnvelope().records;
  const index = records.findIndex((item) => item.id === record.id);
  const nextRecord = clone(record);
  if (index >= 0) records[index] = nextRecord;
  else records.push(nextRecord);
  writeHistory(records);
  return clone(nextRecord);
}

export async function deleteHistoryRecord(id) {
  const records = readHistoryEnvelope().records;
  const next = records.filter((item) => item.id !== id);
  if (next.length === records.length) return false;
  writeHistory(next);
  return true;
}

export async function clearHistoryRecords() {
  writeHistory([]);
}

export { emitStorageError };

