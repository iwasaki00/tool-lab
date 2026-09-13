"use strict";

export const ATTENDANCE_STATES = Object.freeze({
  DISABLED: "disabled",
  IDLE: "idle",
  PREPARING: "preparing",
  PRESENT: "present",
  CANDIDATE: "absence_candidate",
  PENDING: "absence_pending",
  PAUSED: "absence_paused",
  RETURNED: "returned"
});

export const DEFAULT_ATTENDANCE_OPTIONS = Object.freeze({
  enabled: true,
  autoPauseEnabled: true,
  warmupMs: 3_000,
  pendingAfterMs: 10_000,
  pauseAfterMs: 30_000,
  autoResume: false
});

function wallNow() {
  return Date.now();
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function customEvent(type, detail) {
  if (typeof CustomEvent === "function") return new CustomEvent(type, { detail });
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail, enumerable: true });
  return event;
}

function normalizePauseAfter(value, fallback = 30_000) {
  if (value === null || value === false || value === "off" || value === "never") {
    return Number.POSITIVE_INFINITY;
  }
  if (value === Number.POSITIVE_INFINITY) return value;
  return Math.max(0, finiteNumber(value, fallback));
}

function normalizeFaceState(face) {
  if (typeof face === "boolean") return face ? "present" : "absent";
  if (face?.present === true || face?.state === "present") return "present";
  if (face?.absent === true || face?.state === "absent") return "absent";
  if (face?.preparing === true || face?.state === "preparing") return "preparing";
  return "unknown";
}

/**
 * Attendance policy is isolated from the timer.  Consumers react to `pause`
 * and `return` events; this controller never starts or stops a timer directly.
 */
export class AttendanceController extends EventTarget {
  constructor(options = {}) {
    super();
    this.callbacks = options.callbacks ?? {};
    this.configure(options, { emit: false });
    this.monitoring = false;
    this.monitoringStartedAt = null;
    this.state = this.options.enabled ? ATTENDANCE_STATES.IDLE : ATTENDANCE_STATES.DISABLED;
    this.#clearCycle();
  }

  configure(options = {}, { emit = true } = {}) {
    const previous = this.options ?? DEFAULT_ATTENDANCE_OPTIONS;
    const merged = { ...DEFAULT_ATTENDANCE_OPTIONS, ...previous, ...options };
    this.options = {
      enabled: Boolean(merged.enabled),
      autoPauseEnabled: Boolean(merged.autoPauseEnabled),
      warmupMs: Math.max(0, finiteNumber(merged.warmupMs, 3_000)),
      pendingAfterMs: Math.max(0, finiteNumber(merged.pendingAfterMs, 10_000)),
      pauseAfterMs: normalizePauseAfter(merged.pauseAfterMs),
      autoResume: Boolean(merged.autoResume)
    };
    if (!this.options.enabled && this.state !== undefined) {
      this.monitoring = false;
      this.monitoringStartedAt = null;
      this.#clearCycle();
      this.#setState(ATTENDANCE_STATES.DISABLED, { reason: "disabled" }, emit);
    } else if (this.options.enabled && this.state === ATTENDANCE_STATES.DISABLED) {
      this.#setState(ATTENDANCE_STATES.IDLE, { reason: "enabled" }, emit);
    }
    return this.getSnapshot();
  }

  setMonitoring(active, { now = wallNow(), reason = "timer", forceReset = false } = {}) {
    const wasMonitoring = this.monitoring;
    this.monitoring = Boolean(active) && this.options.enabled;
    if (this.monitoring && !wasMonitoring) this.monitoringStartedAt = now;
    if (!this.monitoring) this.monitoringStartedAt = null;
    if (!this.monitoring && (forceReset || !this.#isAwaitingReturn())) {
      this.#clearCycle();
      this.#setState(
        this.options.enabled ? ATTENDANCE_STATES.IDLE : ATTENDANCE_STATES.DISABLED,
        { now, reason }
      );
    } else if (this.monitoring && this.state === ATTENDANCE_STATES.IDLE) {
      this.#setState(ATTENDANCE_STATES.PREPARING, { now, reason });
    }
    return this.getSnapshot(now);
  }

  update(face, context = {}) {
    const now = finiteNumber(context.now, wallNow());
    if (typeof context.monitoring === "boolean" && context.monitoring !== this.monitoring) {
      this.setMonitoring(context.monitoring, { now, reason: "camera_update" });
    }
    const faceState = normalizeFaceState(face);

    if (!this.options.enabled) {
      this.#setState(ATTENDANCE_STATES.DISABLED, { now, reason: "disabled" });
      return this.getSnapshot(now);
    }

    // Breaks never count as absence, even if the camera remains enabled.
    if (context.isBreak) {
      this.#clearCycle();
      this.#setState(ATTENDANCE_STATES.IDLE, { now, reason: "break" });
      return this.getSnapshot(now);
    }

    // Once an automatic pause occurred, keep watching for the learner's return
    // even though the timer itself is no longer running.
    const effectiveMonitoring = this.monitoring || this.#isAwaitingReturn();
    if (!effectiveMonitoring) {
      this.#clearCycle();
      this.#setState(ATTENDANCE_STATES.IDLE, { now, reason: "not_monitoring" });
      return this.getSnapshot(now);
    }

    if (
      !this.#isAwaitingReturn()
      && this.monitoringStartedAt !== null
      && now - this.monitoringStartedAt < this.options.warmupMs
    ) {
      this.#clearCycle();
      this.#setState(ATTENDANCE_STATES.PREPARING, { now, reason: "timer_warmup" });
      return this.getSnapshot(now);
    }

    if (faceState === "preparing" || faceState === "unknown") {
      if (this.missingSince === null && !this.#isAwaitingReturn()) {
        this.#setState(ATTENDANCE_STATES.PREPARING, { now, reason: faceState });
      }
      return this.getSnapshot(now);
    }

    if (faceState === "present") return this.#handlePresent(now);
    return this.#handleAbsent(now);
  }

  #handleAbsent(now) {
    if (this.state === ATTENDANCE_STATES.RETURNED) return this.getSnapshot(now);

    if (this.missingSince === null) {
      this.missingSince = now;
      this.#setState(ATTENDANCE_STATES.CANDIDATE, {
        now,
        absenceDetectedAt: this.missingSince
      });
      this.#emit("candidate", this.#eventDetail(now));
    }

    const absentForMs = Math.max(0, now - this.missingSince);
    if (absentForMs >= this.options.pendingAfterMs && this.pendingAt === null) {
      this.pendingAt = this.missingSince + this.options.pendingAfterMs;
      this.#setState(ATTENDANCE_STATES.PENDING, {
        now,
        absenceDetectedAt: this.missingSince,
        pendingAt: this.pendingAt
      });
      this.#emit("pending", this.#eventDetail(now));
    }

    const shouldPause = this.options.autoPauseEnabled
      && Number.isFinite(this.options.pauseAfterMs)
      && absentForMs >= this.options.pauseAfterMs;
    if (shouldPause && this.autoPausedAt === null) {
      this.autoPausedAt = now;
      this.#setState(ATTENDANCE_STATES.PAUSED, {
        now,
        absenceDetectedAt: this.missingSince,
        autoPausedAt: now
      });
      this.#emit("pause", this.#eventDetail(now));
    }

    return this.getSnapshot(now);
  }

  #handlePresent(now) {
    if (this.state === ATTENDANCE_STATES.PAUSED) {
      this.returnedAt = now;
      this.#setState(ATTENDANCE_STATES.RETURNED, { now, reason: "face_returned" });
      const detail = this.#eventDetail(now);
      this.#emit("return", detail);
      if (this.options.autoResume) {
        this.acknowledgeReturn({ resume: true, now, automatic: true });
      }
      return this.getSnapshot(now);
    }

    if (this.state === ATTENDANCE_STATES.RETURNED) return this.getSnapshot(now);

    if (this.missingSince !== null) {
      const detail = this.#eventDetail(now);
      this.#emit("cancel", { ...detail, returnedAt: now });
      this.#clearCycle();
    }
    this.#setState(ATTENDANCE_STATES.PRESENT, { now, reason: "face_present" });
    return this.getSnapshot(now);
  }

  acknowledgeReturn({ resume = false, now = wallNow(), automatic = false } = {}) {
    if (this.state !== ATTENDANCE_STATES.RETURNED) return this.getSnapshot(now);
    const detail = {
      ...this.#eventDetail(now),
      resumedAt: resume ? now : null,
      resume: Boolean(resume),
      automatic: Boolean(automatic)
    };
    this.#emit("resume", detail);
    this.#clearCycle();
    this.#setState(
      resume ? ATTENDANCE_STATES.PRESENT : ATTENDANCE_STATES.IDLE,
      { now, reason: resume ? "resumed" : "kept_paused" }
    );
    return this.getSnapshot(now);
  }

  /** Debug helper: enter an absence of arbitrary duration without a camera. */
  simulateAbsence(durationMs, { now = wallNow(), monitoring = true } = {}) {
    this.monitoring = monitoring;
    this.missingSince = now - Math.max(0, finiteNumber(durationMs, 0));
    this.pendingAt = null;
    this.autoPausedAt = null;
    this.returnedAt = null;
    this.state = ATTENDANCE_STATES.CANDIDATE;
    return this.#handleAbsent(now);
  }

  reset({ now = wallNow(), monitoring = false } = {}) {
    this.monitoring = Boolean(monitoring) && this.options.enabled;
    this.monitoringStartedAt = this.monitoring ? now : null;
    this.#clearCycle();
    this.#setState(
      !this.options.enabled
        ? ATTENDANCE_STATES.DISABLED
        : this.monitoring
          ? ATTENDANCE_STATES.PREPARING
          : ATTENDANCE_STATES.IDLE,
      { now, reason: "reset" }
    );
    return this.getSnapshot(now);
  }

  #clearCycle() {
    this.missingSince = null;
    this.pendingAt = null;
    this.autoPausedAt = null;
    this.returnedAt = null;
  }

  #isAwaitingReturn() {
    return this.state === ATTENDANCE_STATES.PAUSED
      || this.state === ATTENDANCE_STATES.RETURNED;
  }

  #setState(nextState, metadata = {}, emit = true) {
    const previousState = this.state;
    this.state = nextState;
    if (!emit || previousState === nextState) return;
    this.#emit("statechange", {
      previousState,
      state: nextState,
      ...metadata,
      snapshot: this.getSnapshot(metadata.now)
    });
  }

  #eventDetail(now) {
    return {
      state: this.state,
      absenceDetectedAt: this.missingSince,
      pendingAt: this.pendingAt,
      autoPausedAt: this.autoPausedAt,
      returnedAt: this.returnedAt,
      absenceDurationMs: this.missingSince === null ? 0 : Math.max(0, now - this.missingSince),
      autoPauseEnabled: this.options.autoPauseEnabled,
      pauseAfterMs: Number.isFinite(this.options.pauseAfterMs)
        ? this.options.pauseAfterMs
        : null
    };
  }

  #emit(type, detail) {
    this.dispatchEvent(customEvent(type, detail));
    const callbackName = `on${type[0].toUpperCase()}${type.slice(1)}`;
    this.callbacks?.[callbackName]?.(detail);
  }

  getSnapshot(now = wallNow()) {
    const timestamp = finiteNumber(now, wallNow());
    const absentForMs = this.missingSince === null
      ? 0
      : Math.max(0, timestamp - this.missingSince);
    return {
      state: this.state,
      enabled: this.options.enabled,
      monitoring: this.monitoring,
      autoPauseEnabled: this.options.autoPauseEnabled,
      autoResume: this.options.autoResume,
      pendingAfterMs: this.options.pendingAfterMs,
      pauseAfterMs: Number.isFinite(this.options.pauseAfterMs)
        ? this.options.pauseAfterMs
        : null,
      warmupRemainingMs: this.monitoringStartedAt === null
        ? 0
        : Math.max(0, this.options.warmupMs - (timestamp - this.monitoringStartedAt)),
      absenceDetectedAt: this.missingSince,
      pendingAt: this.pendingAt,
      autoPausedAt: this.autoPausedAt,
      returnedAt: this.returnedAt,
      absentForMs,
      pendingRemainingMs: this.missingSince === null
        ? 0
        : Math.max(0, this.options.pendingAfterMs - absentForMs),
      pauseRemainingMs: this.missingSince === null || !Number.isFinite(this.options.pauseAfterMs)
        ? null
        : Math.max(0, this.options.pauseAfterMs - absentForMs)
    };
  }
}

export function createAttendanceController(options) {
  return new AttendanceController(options);
}
